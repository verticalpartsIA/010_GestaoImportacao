# Auditoria Forense E2E — VP Gestão e Importação

| Item | Valor |
|---|---|
| Repositório | `verticalpartsIA/010_GestaoImportacao` |
| Commit auditado | `11291e1fe6d7f3bedd7799ebdff4b67f9ffa05f3` (main, 18/10/2026 22:01 −03, PR #959) |
| Banco | Supabase `jxtqwzmpgofwctqajewt` (confirmado: é o `URL_SB` de `src/supabase.js`) |
| Data | 19/10/2026 |
| Método | Leitura de código (5 frentes paralelas + conferência pessoal dos achados P0/P1), consultas **somente leitura** no banco (catálogo, contagens, políticas, crons, logs HTTP, advisors), suíte de testes local, teste local isolado do `server.js`. Nada foi alterado, commitado ou publicado. |

Base dos links: `https://github.com/verticalpartsIA/010_GestaoImportacao/blob/11291e1fe6d7f3bedd7799ebdff4b67f9ffa05f3/<arquivo>#L<linha>`. As referências abaixo usam `arquivo:linha` nesse commit.

---

## A. Resumo executivo

O VP Gestão é um sistema grande (96 telas, 241 tabelas, 213 funções SQL, 41 Edge Functions, 37 crons) e funcionalmente rico. A automação do banco está saudável: nos últimos 3 dias os 37 crons rodaram sem falha de disparo, não há fila de efeitos parada e as ligações entre tabelas conferidas não têm registros órfãos. Os 616 testes unitários passam.

A segurança é o ponto que decide a nota. O app inteiro ainda fala com o banco pela chave pública (modo `shadow` padrão; só 5 e-mails no piloto `on`), e o banco aceita essa chave em quase tudo:

- **90 tabelas** aceitam `UPDATE` anônimo sem condição, **97** aceitam `INSERT` e **42** aceitam `DELETE`. Entre elas estão a Central de Decisões, os Avais, os signatários dos contratos, as parcelas do instalador, as propostas, os clientes e os e-mails.
- **A identidade do usuário é forjável no navegador**: o `sso_token` é decodificado sem conferir a assinatura.
- **Duas Edge Functions confiam num e-mail enviado pelo navegador**: uma faz escrita real no estoque do Omie, a outra revela o custo da hora (dado de salário).

Na prática, toda alçada, trava e aprovação do sistema é uma regra de tela, não do servidor.

Nos fluxos também há defeitos comprovados:

- A Proposta criada automaticamente nasce com valor R$ 0; há 3 casos no banco.
- A trava dos três avais da P.I. pode ser contornada pelo motor de gatilhos.
- O fim da produção no MES não chega à OP-mãe, então Emissão de NF e SLA não andam.
- A moeda do fornecedor é ignorada na Precificação.

**Score geral ponderado: 4,8 / 10** (confiança média-alta). Os fluxos centrais funcionam no caminho feliz, mas a operação não está protegida contra erro nem contra uso indevido.

---

## B. Scorecard

| # | Dimensão | Peso | Nota | Justificativa (fatos que reduziram a nota) | Confiança |
|---|---|---:|---:|---|---|
| 1 | Arquitetura e organização | 10% | 5,5 | Stores bem separados, motores puros testáveis e documentação extensa. Contra: o mesmo status é gravado por vários caminhos (aprovação do CEO em 2 tabelas, contrato de venda com 5 escritores, embarques espelhados); 360 migrations aplicadas contra 276 arquivos, e a DDL de tabelas centrais não está no repo (E2E-040); Edge Functions órfãs (E2E-039); supabase-js por CDN sem versão fixa nem SRI (E2E-042). | Alta |
| 2 | Interface, navegação e roteamento | 5% | 7,5 | 83 rotas internas + 13 públicas, deep-link por URL e smoke test que abre todas. Contra: "Ver documento" e os cartões de decisão consultam uma coluna inexistente e falham em silêncio (E2E-024). | Alta |
| 3 | Formulários, cadastros e validações | 8% | 6,5 | CPF/CNPJ com dígito verificador; Nº da cotação travado por trigger no banco. Contra: travas do MES, do Dossiê, das vistorias e das parcelas existem só na tela (E2E-017/019/023). | Média-alta |
| 4 | Herança e integridade entre telas | 15% | 4,5 | Proposta automática com R$ 0 (E2E-011); moeda ignorada (E2E-013); quantidades divergentes entre Precificação e Proposta (E2E-029); fim do MES não chega à OP-mãe (E2E-016); eventos perdidos quando chegam antes do nó (E2E-025); dossiê do Contrato de Venda sem proposta/cliente (E2E-032). | Média-alta |
| 5 | Comercial, precificação e contratos | 10% | 5,0 | Motor de precificação com teste golden (963) e assinatura pública por RPC no servidor com trava `FOR UPDATE`. Contra: E2E-011, 012, 013, 014 e 020; a proposta é enviada sem alçada se o Nº for apagado (E2E-012). | Média-alta |
| 6 | Importação e logística | 10% | 5,0 | Importação Varejo sólida (paginação, carga única, dados reais). Contra: trava da P.I. contornável (E2E-009); requisição ao Omie pode duplicar (E2E-018); `IMS_CONTRATADO` fecha etapas de instalação (E2E-038); espelho de embarque órfão (E2E-036/037). As 20 P.I. do banco não têm Nº de cotação: a cadeia de **equipamento** nunca foi exercitada em produção. | Média |
| 7 | PCP, MES, almoxarifado e expedição | 8% | 5,0 | Baixa no Omie idempotente e comparada com o Omie antes de lançar; trava de NF na expedição feita no banco. Contra: E2E-016, 017 e 028; uso real ainda baixo (5 OPs, 1 no MES). | Média |
| 8 | Banco e integridade referencial | 10% | 6,0 | RLS ligada em 241/241 tabelas; 158 FKs; 239 PKs (2 tabelas sem PK); 0 órfãos nas ligações conferidas. Contra: divergência de migrations; dados de herança incompletos (E2E-011, 2 propostas sem vínculo de precificação). | Alta |
| 9 | Segurança, autenticação e autorização | 12% | 1,5 | E2E-001 a E2E-007, comprovados no banco e no código. O que segura a nota acima de 0: RPCs públicas por token bem feitas, `sso-exchange` correto, nenhuma chave secreta no repo. | Alta |
| 10 | Eventos, automações e integrações | 5% | 4,5 | Crons sem falha e Omie/IMAP funcionando. Contra: a fila `fluxo_pendentes` é manipulável pela chave pública e só anda com alguém logado (E2E-015); `garantirNo` fecha pendências reais (E2E-010); eventos esperados nunca são emitidos (E2E-026); avisos vão para a área errada (E2E-027). | Média-alta |
| 11 | Testes e confiabilidade E2E | 7% | 4,5 | 616/616 unitários passam. Contra: o E2E só renderiza, com Supabase simulado; não há teste de RLS, de autenticação nem do motor de eventos; deploy sem gate de CI e lint vazio (E2E-043). | Alta |

### Cálculo

```
Score = Σ(nota × peso) / 100
      = (5,5×10 + 7,5×5 + 6,5×8 + 4,5×15 + 5,0×10 + 5,0×10 + 5,0×8 + 6,0×10 + 1,5×12 + 4,5×5 + 4,5×7) / 100
      = (55 + 37,5 + 52 + 67,5 + 50 + 50 + 40 + 60 + 18 + 22,5 + 31,5) / 100
      = 484 / 100 = 4,8
```

| Score | Composição | Nota |
|---|---|---:|
| Arquitetura | dimensão 1 | **5,5** |
| Integridade E2E | dimensões 4, 5, 6, 7 ponderadas (207,5 / 43) | **4,8** |
| Segurança | dimensão 9 | **1,5** |
| Confiabilidade operacional | dimensões 8, 10, 11 ponderadas (114 / 22) | **5,2** |
| **Geral ponderado** | | **4,8** |

**Confiança do score: média-alta.** Segurança e banco foram conferidos no catálogo de produção. Os fluxos foram conferidos no código e em contagens agregadas, sem clique real. Dimensões com evidência mais fraca: 6 e 7, pelo pouco uso real de equipamento importado e de MES.

---

## C. Inventário das telas

Total: **83 rotas internas** (`src/router.js:25` `KNOWN_ROUTES`) + **13 páginas públicas** (HTML na raiz) = **96 telas**.

Legenda: **P** = investigada em profundidade (código + dados) · **L** = leitura parcial · **N** = não investigada (só aparece no smoke test).

| Módulo | Rotas (estado) |
|---|---|
| Geral | dashboard (L), notificacoes (P), decisoes (P), financeiro / Prazos & Pendências (P), inbox (L: área blindada, só gatilhos e permissões), logs (N), configuracoes (N) |
| CRM / Comercial | leads (P), lead-detail (P), crm-canais (N), crm-conversao (N), crm-automacao (N), crm-analise (N), formularios (L), formulario-elevador (P), formulario-quadro-comando (P), cotacao-quadro-comando (L), controle-cotacoes (L), cotacoes-fornecedor (P), cotacao-fornecedor-detail (P), contratos-sociais (N), precificacao (P), propostas (P), proposta-editor (P), aval-financeiro (P), comissoes (N) |
| Cadastros | cadastro-clientes (P), cadastro-fornecedores (L), cadastro-materias-primas (L), cadastro-produtos (L), ncm-catalogo (N), cadastro-instaladores (L), cadastro-custos (L: só leitura, área sob "Confirmo") |
| Jurídico | juridico (L), contrato-venda-equipamentos (P), aval-juridico (P), contrato-instalador (P), contrato-editor (L), pagamentos-instalador (P) |
| Importação | importacao (P), importacao-detail (P), importacao-rastreamento (L), gi-painel (N), pi-importacao (P), rfq-importacao (P), ims-importacao (P), embarques-importacao (P), gi-analise-precos (N), compras / Importação Varejo (P), cotacoes-varejo (P), pedidos-acompanhamento (N) |
| Engenharia | engenharia (N), eng-projeto-elevadores (P), eng-configurador (N), desenho-tecnico (N), ficha-tecnica (L), solicitacoes-produto (L), ncm-kanban (N), ncm-detail (N) |
| Obra / Instalação | status-obras (L), linha-do-tempo (L), central-documentos (N), dossier-obra (P), vistorias-envio (P), vistorias (P), instalacao (L), art (N), cronograma (N), databook (N), handover (N), rh-homologacao (L) |
| Fabricação / Logística interna | almoxarifado (P), carga-maquina (N), montagem-produto (L), simulacao-producao (N), pcp (P), mes (P), mes-cadastros (L), relatorios-pcp (L), expedicao (P), separacao (L), etiquetas (L), emissao-nf (P) |
| Públicas (sem login) | assinar.html (P), cotacao-elevador-fornecedor.html (P), cotacao-varejo.html (L), cotacao.html (L), formulario-cliente.html (L), formulario-quadro-comando-publico.html (L), vistoria-execucao.html (P), status-obra.html (P), diario-obra.html (P), termo-entrega.html (P), recibo-instalador.html (P), separacao-tv.html (L), index-print.html (N) |

---

## D. Mapa dos fios

Formato: `DOADORA → campo/evento → tabela/API → RECEPTORA`. Resultado: ✅ íntegro · ⚠️ parcial · ❌ rompido.

| Conexão | Resultado | Base |
|---|---|---|
| Formulário → `numero_cotacao` (sequência + trigger) → `formularios_elevador` → Cotação/Precificação/Proposta | ✅ | trigger `trg_formularios_elevador_protege`; UNIQUE no Nº |
| Formulário → unidades/quantidade → `cotacoes_elevador_fornecedor.dados_envio` (snapshot) → Precificação | ⚠️ congela no envio; a Proposta lê a unidade viva | E2E-029 |
| Portal do fornecedor → `respostas.moeda` → Precificação (`valorUnitarioUsd`) | ❌ moeda ignorada | E2E-013 |
| Precificação aprovada → `criarPropostaAutomatica` → `propostas.valor_total` | ❌ R$ 0 (NaN) | E2E-011; banco: 983, 991, 993 |
| Precificação → `precificacao_id` → `propostas` | ⚠️ 13 de 18 propostas com Nº estão ligadas; 958 e 987 têm precificação e não estão | consulta 2 |
| Proposta → margem → `podeEnviarProposta` (CEO < 15%) | ❌ lê a margem da precificação (até rascunho), não o preço da proposta | E2E-012 |
| Proposta assinada (RPC) → `fluxo_pendentes` → eventos, decisão, dossiê, lead | ⚠️ funciona só com alguém logado; a chave pública pode "concluir" sem executar | E2E-015 |
| Proposta aprovada → trigger → `avais_financeiros` / `avais_juridicos` | ✅ (copia `valor_total`, inclusive o 0 de E2E-011) | `fn_avais_abrir_na_proposta` |
| Avais (Pagamento + Jurídico + Engenharia + CEO) → `podeIniciarCompra` → "Decidir comprar" | ✅ lê os avais reais | `aval-financeiro-store.js:384-415` |
| Avais → `gatilhos.COMPRA_LIBERADA` → `verificarGateCompra` → criação da P.I. | ❌ contornável por `garantirNo` | E2E-009 |
| P.I. → `numero_cotacao` → embarque → espelho `embarques` | ✅ trava e propaga; ⚠️ banco: 20/20 P.I. sem Nº (varejo, legítimo) | consulta 1 |
| Embarque excluído → `embarques` espelho | ⚠️ FK `ON DELETE SET NULL`: o espelho fica e continua no mapa | E2E-036 |
| Contrato de Venda → `dossier_obra` (`garantirDossier`) | ⚠️ grava sem `proposta_id`/`cliente_id` | E2E-032 |
| Contrato assinado (representante + signatários) → `_cv_finalizar` | ✅ no servidor, com `FOR UPDATE` | migration `20261005110000` |
| Contrato Instalador → parcelas → Pagamentos | ⚠️ parcelas não acompanham edição; "paga" sem trava no servidor | E2E-001, Cadeia D #7/#8 |
| Dossiê "Instalação/DataBook" → `INSTALACAO_CONCLUIDA` → liberação da parcela final | ❌ sem trava (qualquer escolha no combo) | E2E-019 |
| Vistorias → `vistorias_atividades` → checklist obra pronta / Status / Linha do tempo | ✅ fonte única; ⚠️ gravação pública por id | E2E-023 |
| Pedido de Quadro → OP-mãe + frentes → `pcp_ordens` | ⚠️ não transacional, sem unicidade | E2E-028 |
| MES conclui → `pcp_ordens` (frente) → OP-mãe → Emissão de NF / SLA | ❌ a mãe não é concluída | E2E-016 |
| OP concluída → `pcp-omie-escrever baixa_producao` → Omie | ✅ idempotente; ❌ sem alçada no servidor | E2E-004 |
| Pedido Omie (etapa 20) → `sync-pcp-pedidos` → `pcp_pedidos` → Fila/NF/Expedição | ✅ crons sem falha | cron, `pcp_sync_log` |
| Expedição → NF obrigatória (trigger) | ✅ | `fn_pcp_expedicao_exige_nf` |
| Importação Varejo → requisição Omie → `importacao_varejo_comprado` | ✅ registra; ⚠️ Cotações de Varejo podem duplicar | E2E-018 |
| `send-email` / `read-inbox` → `emails_projeto` → Inbox / Tratativas | ✅ cron a cada 10 min; ~4% de timeouts | E2E-044 |
| Decisão aprovada → `decisoes_gerenciais` → gates | ⚠️ funciona; aprovação gravável pela chave pública | E2E-001 |
| Proposta → "Ver documento" / contexto do cartão de decisão | ❌ `order('updated_at')` em tabela sem a coluna | E2E-024 |

---

## E. Anomalias

Ordenadas por severidade. "Comprovado no banco" = política, grant ou contagem lida no catálogo de produção; **nenhuma escrita foi feita para "provar" exploração**.

### P0 — Críticas

**ID:** E2E-001
**Severidade:** P0 · **Classificação:** Curto-circuito · **Confiança:** Comprovado (banco)
**Tela de origem / receptora:** todas as que gravam / Central de Decisões, Avais, Assinatura, Pagamentos a Instaladores, Propostas, Cotações
**Propósito operacional:** só usuários autorizados aprovam, assinam, pagam e mudam preço.
**Esperado:** escrita apenas por usuário autenticado com alçada.
**Encontrado:** políticas para `public`/`anon` **sem condição**:

- UPDATE em 90 tabelas, INSERT em 97, DELETE em 42, ALL em 61.
- Exemplos: `decisoes_gerenciais` (INSERT/UPDATE), `avais_financeiros` (UPDATE/DELETE), `avais_juridicos`, `documento_signatarios` e `contrato_venda_signatarios` (UPDATE/DELETE), `contrato_instalador_parcelas` (ALL), `contratos_instalador` (ALL), `propostas` (ALL), `precificacoes_elevador` (ALL), `cotacoes_elevador_fornecedor` (ALL), `clientes` (ALL), `emails_projeto` (ALL), `vistorias_atividades`/`_respostas` (ALL), `mes_ordens` e `pcp_ordens` (UPDATE), `alertas` (UPDATE), `eventos_fluxo` (DELETE).
- `has_table_privilege('anon', …, 'UPDATE')` = true para decisões, signatários, avais e propostas.
- A trava `vp_valores_guarda` só age se `current_user = 'authenticated'`: o anon passa (`pg_get_functiondef('vp_valores_guarda')`).

**Evidência:**

```sql
select cmd, count(distinct tablename) from pg_policies
 where (roles::text like '%anon%' or roles::text like '%public%')
   and coalesce(qual,'true')='true' and coalesce(with_check,'true')='true'
 group by cmd;
```

**Consequência:** com a chave pública (que está no código do site), sem login, é possível:

- marcar `aval_pagamento_confirmado=true`;
- aprovar uma decisão do CEO;
- pôr `status='assinado'` num signatário ou apagar signatários pendentes (`_cv_pendentes` zera e a próxima assinatura fecha o contrato);
- marcar parcela de instalador como paga ou liberada;
- trocar preços.

**Impacto em outras telas:** todas as travas de compra, pagamento e assinatura.
**Prioridade:** imediata.
**Recomendação:** concluir a Fase 4 do plano #571 (`vp_fechar_tabela` por ondas, começando por decisões, avais, signatários e parcelas); migrar as escritas públicas restantes para RPC por token.

**ID:** E2E-002
**Severidade:** P0 · **Classificação:** Curto-circuito (vazamento) · **Confiança:** Comprovado (banco)
**Tela:** Inbox, Cadastros, Notificações, PCP
**Esperado:** dado pessoal e comercial lido só por usuário autenticado.
**Encontrado:** SELECT anônimo sem condição em 130 tabelas, entre elas:

- `emails_projeto`: 66 e-mails com corpo, remetentes, cotações e anexos assinados;
- `clientes`: 1.231 cadastros, com CNPJ e contato;
- `perfis` (48) e `alertas`;
- `avais_financeiros`;
- `pcp_hh_apontamentos` (quem trabalhou e quantas horas);
- `pcp_omie_fila` (payloads enviados ao Omie).

**Consequência:** qualquer pessoa com a chave pública lê a carteira de clientes e as conversas com fornecedores e clientes.
**Prioridade:** imediata.
**Recomendação:** fechar a leitura dessas tabelas para `anon` junto com E2E-001.

**ID:** E2E-003
**Severidade:** P0 · **Classificação:** Curto-circuito · **Confiança:** Comprovado (código)
**Tela:** todas (identidade `window.__VP_USER`)
**Esperado:** identidade verificada pelo emissor do token.
**Encontrado:** `src/supabase.js:116-119` decodifica o payload do `sso_token` e grava o usuário **sem verificar a assinatura**. A validação em `:123-130` só atualiza quando dá certo; quando falha, mantém o decode (`/* offline/expirado: mantém o decode local */`). Editar `sessionStorage.vpprd_user` também funciona (`:107-109`).
**Consequência:** `?sso_token=x.<base64 {"email":"ceo@..."}>.y` faz o navegador agir como o CEO. Isso alimenta `temCapacidade` (`proposta-store.js:682-705`), `souAprovador` (`decisoes-store.js:259`), VPLog, `enviadoPor` e o filtro de notificações.
**Impacto:** toda alçada de tela; trilha de auditoria (`vp_logs`, `eventos_fluxo.ator_nome`) não confiável.
**Prioridade:** imediata.
**Recomendação:** só gravar identidade depois de `/auth/v1/user` responder OK (ou depender exclusivamente da sessão do `sso-exchange`).

**ID:** E2E-004
**Severidade:** P0 · **Classificação:** Curto-circuito · **Confiança:** Comprovado (código + lista de funções)
**Tela:** PCP (baixa de produção), Almoxarifado (requisição, ajuste, estrutura), Reposição/Necessidade
**Esperado:** escrita real no ERP só por quem tem `almoxarifado.escrever_omie`.
**Encontrado:**

- `supabase/functions/pcp-omie-escrever/index.ts:138` lê `solicitante` do corpo e só valida o formato do e-mail.
- `:141` admite "sem credencial de usuário verificável"; existe apenas limite de taxa.
- A alçada é conferida em `src/pcp.jsx:116`, só na tela.
- `verify_jwt:true` aceita a própria chave pública.

**Consequência:** requisições de compra e ajustes ENT/SAI/SLD no estoque do Omie (local VERTICAL MP) podem ser disparados sem login. Somado a E2E-001 (`pcp_ordens` UPDATE anônimo), uma OP pode ser "concluída" com quantidade arbitrária e baixada.
**Prioridade:** imediata.
**Recomendação:** validar o JWT do usuário (sessão do `sso-exchange`) e conferir a alçada no servidor.

### P1 — Altas

**E2E-005 — `pcp-hh` libera custo da hora (salário) para quem declarar um e-mail de Administrador.**
Curto-circuito · Comprovado.
- `pcp-hh/index.ts:258` faz `const quem = String(b.solicitante_email || "")`; `temAlcada` (`:99-106`) aceita `nivel === "Administrador"`.
- Consequência: a ação `custos` devolve o valor da hora calculado a partir dos títulos de salário do Omie; `apontar`/`editar`/`remover` também ficam abertos.
- Recomendação: identidade pelo JWT.

**E2E-006 — `whatsapp-notify` envia mensagens arbitrárias pelo número da empresa.**
Curto-circuito · Comprovado (código).
- Destinatários e texto vêm do chamador (`whatsapp-notify/index.ts:119`, `motivo` interpolado em `:51`); busca o telefone em `perfis.whatsapp_number` com a chave de serviço; não tem limite de taxa.
- `verify_jwt:true` aceita a chave pública.
- Consequência: phishing interno com o número oficial.

**E2E-007 — Pedido recusado com a sessão é refeito com a chave pública.**
Curto-circuito · Comprovado.
- `src/vp-auth.js:153-162`: em 401/403 faz `return fetch(input, init)` com a chave pública. Só a recusa da trava de valores (`vp_valores`) não é refeita.
- O comportamento está fixado por teste (`src/vp-auth.test.js:146,175`).
- Hoje o impacto é limitado, porque o anon já tem acesso (E2E-001). Quando as tabelas forem fechadas, este recuo pode mascarar recusas que deveriam aparecer.
- Recomendação: remover o recuo antes de fechar as tabelas.

**E2E-009 — Trava dos três avais na criação da P.I. contornável.**
Curto-circuito · Comprovado.
- `decisoes-store.js:608-609` só aceita `gatilhos.COMPRA_LIBERADA.status === 'ok'`.
- `gatilhos-engine.js:707-719` (`garantirNo`) cria e fecha **como ok** todo predecessor que falta, sem olhar `requerEventos`.
- Salvar um RFQ com o Nº (`rfq-store.js:97-99` emite `RFQ_FRETE_ENVIADO`) ou um embarque com agente de carga sobe a cadeia RFQ_FRETE → CARGO_READY → NEGOCIACAO_COMPRA → COMPRA_LIBERADA e marca tudo como ok.
- Além disso, `pi-store.js:119-130` não confere trava nenhuma; ela só existe em `pi.jsx:476-479`.
- Consequência: a P.I. (compra na China) é criada sem Aval de Pagamento, Jurídico ou Engenharia.

**E2E-010 — `garantirNo` fecha como "retroativo" uma pendência que acabou de abrir (Aval de Pagamento).**
Fio rompido · Comprovado.
- `gatilhos-engine.js:705-708`: se o predecessor existe e está aberto, fecha.
- `CEO_APROVOU` tem `AVAL_PAGAMENTO` como predecessor SS e nasce no mesmo evento `SINAL_PAGO`.
- Consequência: com margem < 15% ou desconhecida, a etapa "Aval de Pagamento" some de Prazos & Pendências e dos alertas. A compra continua travada por `requerEventos`, mas ninguém é cobrado.

**E2E-011 — Proposta criada automaticamente nasce com `valor_total = 0`.**
Fio rompido · Comprovado (código + banco).
- `precificacao-elevador-store.js:896` faz `Number(...valores?.valorUnit)`, e `valorUnit` é texto pt-BR (`proposta-opcoes.js:260`, `textoBR` → `"257025,50"`). `Number("257025,50")` = NaN, que vira 0.
- Banco: propostas **983, 991 e 993** (rascunho, com `precificacao_id`) estão com `valor_total = 0`.
- O trigger copia o valor para `avais_financeiros.valor_total`. Os cartões de decisão e o Contrato de Venda também leem esse campo.
- Corrige-se sozinho apenas quando o vendedor salva no editor.

**E2E-012 — Alçada do CEO decidida pela margem da Precificação (até rascunho), não pelo preço da Proposta; envio sem alçada se o Nº for apagado.**
Curto-circuito · Comprovado.
- `decisoes-store.js:487-489` usa `margemEfetivaDaCotacao`; `:451` cai em `data[0]` quando não há finalizada (o banco tem 7 rascunhos e 2 calculadas entre 23).
- `proposta-form.jsx:868` deixa editar `valorUnit` livremente.
- `decisoes-store.js:474` faz `if (numeroCotacao == null) return { ok: true }`.
- Consequência: o vendedor baixa o preço e o CEO não é chamado.

**E2E-013 — Moeda do fornecedor ignorada.**
Fio rompido · Comprovado.
- O portal grava `moeda` (USD/EUR/CNY/BRL; `cotacao-elevador-fornecedor.jsx:13-14,232`).
- `precificacao-elevador-store.js:576,583` lê `preco_unitario`/`preco_total` como USD; o mesmo acontece em `:937,943` e em `cotacao-elevador-fornecedor-store.js:651`.
- Consequência: cotação em CNY ou BRL é convertida pelo dólar.

**E2E-014 — Proposta gravada com `vendedor_id` de quem salva (ex.: Financeiro).**
Fio rompido · Comprovado (código).
- `proposta-store.js:815-816` usa `resolverVendedorId()`, que é o usuário logado.
- A política `vp_valores_dono` (`20261010140000`) restringe vendedores às próprias propostas.
- Consequência: a vendedora restrita não vê a proposta da própria cotação, e a checagem de duplicidade roda sob a mesma RLS.

**E2E-015 — Fila de efeitos da assinatura pública é manipulável e só anda com alguém logado.**
Curto-circuito · Comprovado (advisor + grants + código).
- `fluxo_pendentes_reivindicar` e `fluxo_pendentes_concluir` são executáveis por `anon` (advisor `anon_security_definer_function_executable`).
- Qualquer um pode reivindicar itens, ler o payload e marcá-los como concluídos sem executar: eventos, decisão do CEO, dossiê e vínculo lead → cliente se perdem.
- `fluxo-pendentes.js:224` só processa com usuário interno logado.
- `falhou` nunca é reprocessado.
- Banco hoje: 6 itens, todos concluídos (sem fila parada).

**E2E-016 — Fim do MES não conclui a OP-mãe; Emissão de NF e SLA não andam.**
Fio rompido · Comprovado.
- `mes.jsx:252-258` conclui só a frente; nada conclui a mãe (só `concluirMae`, manual, em `pcp.jsx:433-435`).
- `emissao-nf.jsx:108` e `alerta-pcp-prazos:175` classificam pela mãe.
- Além disso, o MES não atualiza `pcp_ordem_etapas`, então "Concluir OP" no PCP fica travado.

**E2E-017 — Travas do MES só na tela.**
Curto-circuito · Comprovado.
- `validarGate` (`mes.jsx:205-226`) roda no cliente.
- `mes_ordens`, `mes_execucoes` e `mes_checklist_resultados` têm `for update using (true)` (`mes_fase1.sql:102`); confirmado no banco.
- Consequência: um PATCH direto pula checklist, NC, furos e testes.

**E2E-018 — Requisição ao Omie pode duplicar em Cotações de Varejo.**
Curto-circuito · Comprovado (código).
- `cotacoes-varejo-store.js:223` grava `requisicoes` sem conferir erro; a promessa de "reenvio pula os já enviados" depende dessa gravação e do estado em memória.
- A Edge Function `criar-requisicao…` usa `codIntReqCompra: IV-${Date.now()}` (`index.ts:140`), que não é idempotente.
- Duplo clique, duas abas ou falha de gravação geram requisição repetida no Omie.

**E2E-019 — Avançar etapa do Dossiê libera a parcela final do instalador sem trava.**
Curto-circuito · Comprovado.
- `dossier-obra.jsx:583` deixa escolher qualquer etapa.
- `dossier-store.js:212-217` emite `INSTALACAO_CONCLUIDA` em "DataBook".
- `eventos-fluxo-store.js:137-139` chama `verificarLiberacaoParcelas`.
- Não exige Termo de Entrega nem checklist.

**E2E-020 — Contrato de Venda assinado pode ter o texto regravado.**
Curto-circuito · Comprovado.
- `contrato-venda-store.js:470-494` (`updateFormState`) reconstrói `doc` e faz `update` sem filtro de status e sem conferir `error`.
- É chamado por `CVD0Section` (`contrato-venda.jsx:1029`), presente no painel de contratos assinados.
- O hash da assinatura cobre o `form_state` antigo, então a integridade documental se perde.

**E2E-022 — Caminho antigo das assinaturas públicas grava status direto na tabela.**
Curto-circuito · Comprovado.
- Quando a RPC falha, ou com `localStorage.vp_public_rpc='off'` (controlado pelo cliente), `markSigned` calcula o status no navegador e faz `update(...).eq('token', token)` sem conferir expiração nem status (`contrato-venda-store.js:271, 621-633`).
- O mesmo padrão existe nos stores do instalador, signatários e termo.

**E2E-023 — Página pública de vistoria grava por id; a "conclusão" só é travada na tela.**
Curto-circuito · Comprovado.
- `vistoria-execucao.jsx:433, 452, 570` usam `.eq('id', …)` direto.
- A checagem de obrigatórios (`:556-560`) roda só no cliente.
- Três vistorias "concluída" liberam o checklist de obra pronta (`instalacao-obra-store.js:39-41`).

### P2 — Médias

| ID | Classe · Confiança | Achado e evidência |
|---|---|---|
| E2E-024 | Fio rompido · Comprovado (banco + código) | `decisoes-store.js:416` e `decisoes.jsx:195` fazem `propostas…order('updated_at')`, mas `propostas` tem `atualizado_em` e **não** `updated_at` (`information_schema`). O erro é engolido: cartões de decisão sem cliente, valor e proposta, e "Ver documento" cai no Formulário. Fica em área blindada (decisoes.jsx). |
| E2E-025 | Fio rompido · Comprovado | `gatilhos-engine.js:660` (`fecharNo` retorna se o nó não nasceu) e `nascerNo` não consulta eventos passados. Um RFQ ou cargo-ready lançado antes de "Aprovar" na cotação deixa RFQ_FRETE/CARGO_READY pendentes para sempre. |
| E2E-026 | Fio rompido · Comprovado | Nenhum código emite `VISTORIA_AGENDADA`, `VISTORIA_REALIZADA`, `PENDENCIA_INSTALACAO_REGISTRADA` ou `PAGAMENTO_FORNECEDOR_1_SOLICITADO`, mas o motor espera esses eventos. Os nós só aparecem como "retroativo"; PAGAMENTO_1_SOLICITADO nunca fecha. |
| E2E-027 | Fio rompido · Comprovado | `_evt_modulo_etapa` (migration `20261016120000`) usa `DATA_BOOK_MONTADO`, mas o nó é `DATABOOK_MONTADO`. Outros nós caem em `else 'Comercial'`, então os avisos vão aos líderes errados. Etapas puladas também geram "Etapa aberta". |
| E2E-028 | Curto-circuito · Comprovado | Geração de OPs (`pcp.jsx:1043-1077, 1286-1311`) é sequencial, sem transação e sem UNIQUE por pedido. Falha parcial deixa OP-mãe órfã; duas abas geram duas mães. |
| E2E-029 | Fio rompido · Forte indício | A Precificação congela a quantidade do envio (`precificacao-elevador-store.js:566-575`); a Proposta usa a unidade viva (`proposta-heranca.js:137`) e não filtra unidades por tipo de equipamento (`:92`). |
| E2E-030 | Fio rompido · Forte indício | A 2ª precificação do mesmo Nº colide com o UNIQUE `numero_documento` (`precificacao-elevador-store.js:648-649`). |
| E2E-031 | Curto-circuito · Comprovado | `criarDecisaoSeNaoExiste` (`decisoes-store.js:146-148`) faz `maybeSingle` sem UNIQUE `(tipo, numero_cotacao)`: chamadas concorrentes duplicam, e depois cada chamada cria outra. |
| E2E-032 | Fio rompido · Comprovado | `contrato-venda-store.js:213-222` cria o dossiê sem `proposta_id`/`cliente_id`/`lead_id`, e o Status da Obra não acha o contrato. No banco, 61/67 dossiês não têm `proposta_id` (a maioria legado: 66/67 sem Nº). |
| E2E-033 | Fio rompido · Comprovado (latente) | `instalacao-obra-store.js:233` e `instalacao-checklist-store.js:286` usam `maybeSingle` por `proposta_id`. Com um aditivo (`-2`) o checklist marca "Contrato assinado" como falso. Hoje há 1 contrato. |
| E2E-034 | Curto-circuito · Comprovado | "Gerar novo link" do Termo de Entrega (`termo-entrega-store.js:82-92`) zera assinaturas parciais sem checar o status. |
| E2E-035 | Curto-circuito · Comprovado | Excluir vistoria concluída é permitido (`vistorias-envio.jsx:882`) e reduz a contagem do gate de 3 vistorias. |
| E2E-036 | Fio rompido · Comprovado (latente) | `remover()` do embarque (`embarques-importacao-store.js:203-210`) só apaga `embarques_importacao`; a FK do espelho é `ON DELETE SET NULL`, então a linha continua no Mapa de navios. Hoje há 0 espelhos órfãos. |
| E2E-037 | Curto-circuito · Comprovado | `logistica.jsx:185` engole a falha do store e insere direto em `embarques` com origem nula, recriando o caminho duplo. |
| E2E-038 | Curto-circuito · Comprovado | `ims-store.js:88-90` emite `IMS_CONTRATADO` já na solicitação; `EQUIPAMENTO_RECEBIDO` nasce e `garantirNo` fecha CI/vistorias/dossiê como ok. |
| E2E-039 | Outro · Comprovado (banco) | Edge Function `sync-pi-omie-pagamentos` está ACTIVE (v7) **sem pasta** em `supabase/functions/`, e o CLAUDE.md a registra como apagada. `send-email-next` (cópia de teste) também está ACTIVE sem pasta. Viola a regra "nenhuma função em produção sem pasta". |
| E2E-040 | Outro · Comprovado (banco) | 360 migrations aplicadas contra 276 arquivos. A DDL de `pi_importacao`, `embarques_importacao`, `central_decisoes_fase1`, `enable_rls_13_tabelas_sem_protecao`, `estoque_eventos_e_sessoes` e `importacao_varejo_alerta_dia_d` não existe no repo: o banco não é reproduzível a partir do git. |
| E2E-041 | Curto-circuito · Comprovado **localmente** | `server.js:414-419` confere só o 1º segmento cru do caminho. Com express 4.22.2 / send 0.19.2 (versões do `package-lock.json`), `GET /src/%2e%2e/server.js` → 200 (23 KB), `/src/%2e%2e/CLAUDE.md` → 200 (529 KB), `/src/%2e%2e/supabase/migrations/…` → 200. Dotfiles continuam bloqueados (`/.env` → 404). **Produção não testada.** O vazamento é de código e documentação interna, sem segredo conhecido. |
| E2E-042 | Risco · Comprovado | `index.html:48` carrega `@supabase/supabase-js@2` sem versão exata nem `integrity`; jspdf e html2canvas também não têm SRI. |
| E2E-043 | Outro · Comprovado | O E2E abre as telas com Supabase simulado (`e2e/helpers.js:60-78`: leitura `[]`, escrita 403) no bypass `dev@localhost`. Não há teste de RLS/autenticação nem de `onEvento`/`garantirNo`. `deploy.yml` não depende do CI e `npm run lint` é `echo`. |
| E2E-045 | Fio rompido · Risco | Selects com `.limit(5000/10000/20000)` acima do teto de 1000 do PostgREST (`pcp.jsx:1477, 700, 1479`; `almoxarifado.jsx:1029`; `cotacoes-varejo-store.js:105`). Volumes atuais estão abaixo: estrutura 365, itens PCP 277. |
| E2E-046 | Fio rompido · Risco | `sync-estoque-omie/index.ts:135` lê no máximo 60 páginas (6.000 produtos) sem registrar o corte. |
| E2E-047 | Curto-circuito · Comprovado | Escritas sem conferir `.error` em pontos de estado: `mes.jsx:246` (etapa da OP depois de fechar a execução), `ficha-tecnica-store.js:184`, `contrato-venda-store.js:494`, `aval-financeiro-store.js:204`, `proposta-form.jsx:846` (descontos sem await). |

### P3/P4 — Baixas e melhorias

- **E2E-044 (P3):** `net._http_response` registra 15 timeouts de 20 s em ~400 chamadas nos últimos 2 dias (~4%), sempre em minutos múltiplos de 10 (padrão de `read-inbox-poll`). Sem HTTP ≥ 400.
- **E2E-048 (P4):** o CLAUDE.md repete "3 falhas pré-existentes em `instalacao-obra-store.test.js`"; hoje a suíte passa 616/616. Dois testes dependem de fuso e ICU (`fmtData` falha com `TZ=Pacific/Kiritimati`).
- **E2E-049 (P3):** IDs `DOS-`/`HIS-` com `Date.now().slice(-6)` repetem a cada ~16,7 min (`dossier-store.js:36,110,223`).
- **E2E-050 (P3):** `public_cv_assinar` aceita contrato em `rascunho`; o signatário recebe o `audit` do representante (IP, UA, rubrica).
- **E2E-051 (P4):** advisor do Supabase com 39 funções de `search_path` mutável e 1 view `SECURITY DEFINER` (`estoque_catalogo_publico_v`, intencional: catálogo sem saldo).

### Hipóteses anteriores reavaliadas

| Hipótese | Veredito | Evidência atual |
|---|---|---|
| P.I./RFQ/IMS/Embarques sem `numero_cotacao` | **Confirmado o dado, DESCARTADO como defeito** | 20/20 P.I., 2/2 RFQ, 4/4 IMS e 7/7 embarques sem Nº. A regra registrada do usuário (12/10) diz que varejo sem Nº é legítimo. Todas as P.I. têm `embarque_id` válido (0 órfãs). Efeito real: a cadeia de equipamento nunca rodou em produção. |
| `propostas.precificacao_id` ausente | **Parcial** | 314/327 nulos, mas 309 propostas não têm Nº (legado importado, 301 "enviada"). Das 18 com Nº, 13 estão ligadas, 958 e 987 (rascunho) têm precificação e não estão ligadas, e 3 não têm precificação. |
| `dossier_obra.proposta_id` ausente | **Confirmado, maioria legado** | 61/67 nulos; 66/67 sem Nº. O código atual corrige em `criarDeProposta`, mas não em `garantirDossier` (E2E-032). 0 órfãos. |
| `pi_importacao.embarque_id` órfão | **Descartado** | 0 órfãos; FK `ON DELETE SET NULL`. |
| Espelho `embarques_importacao` → `embarques` | **Íntegro hoje, risco latente** | 7/7 espelhados, 0 sem espelho, 0 órfãos; ver E2E-036/037. |
| Leitura/gravação pública | **Confirmado e ampliado** | E2E-001/002 (191 tabelas com alguma política anon/public). |
| Fallback para chave pública explorável | **Confirmado como mecanismo** | E2E-007. O acesso anônimo direto (E2E-001) já é o caminho mais curto. |
| 3 testes falhando | **Descartado** | 616/616. |
| `server.js` expõe proxy service-role de Propostas | **Descartado em produção** | `PROPOSTAS_SB_SVC` não existe nas variáveis do Hostinger (só `GITHUB_TOKEN`, `OMIE_API_KEY`, `OMIE_API_SECRET`, `VITE_TRACK_ACTIVITY_KEY`) e o proxy fica OFF. Continua sem autenticação no código (P4). |

---

## F. Supabase

| Verificação | Resultado |
|---|---|
| Inventário | 241 tabelas, 4 views, 213 funções em `public`; 41 Edge Functions ACTIVE; 37 crons ativos |
| RLS | ligada em **241/241**; 30 tabelas com RLS e sem política (fechadas de propósito: `app_secrets`, `api_rate_log`, `pcp_hh_custos`…) |
| Políticas anon/public sem condição | SELECT 129 · INSERT 97 · UPDATE 90 · DELETE 42 · ALL 61 (por tabela; ver E2E-001) |
| Tabelas já fechadas a `authenticated` | 80 com alguma política só `authenticated` (ex.: `contratos_venda_equipamentos`, `iv_cotacao_*`, `estoque_*`) |
| Sessões | 38 perfis ativos, 20 usuários em `auth.users` (18 ativos nunca entraram com sessão própria); último login 16/10; 5 e-mails no piloto `on` |
| Funções SECURITY DEFINER executáveis por anon | 62 (advisor). A maioria são RPCs `public_*` por token, por desenho. Indevidas: `fluxo_pendentes_reivindicar/concluir` (E2E-015) e `vp_ve_valor(p_perfil, p_tag)`, a confirmar. |
| Integridade referencial | 158 FKs, 239 PKs, 2 tabelas sem PK; 0 órfãos em P.I.→embarque, espelho→embarque, dossiê→proposta, contrato→proposta |
| Crons (3 dias) | 0 falhas de disparo em 37 jobs; `pcp_sync_log` só com `ok=true`; `estoque-reconciliacao-diaria` ainda sem execução (só seg–sex) |
| Chamadas HTTP dos crons | ~400, 0 HTTP ≥ 400, 15 timeouts (E2E-044) |
| Edge Functions × repo | 2 publicadas sem pasta (E2E-039); 4 pastas em `functions-removidas/` |
| Migrations | 360 aplicadas × 276 arquivos (E2E-040) |
| Uso real (contagens) | propostas 327 (3 aprovadas), precificações 23, formulários 49, contrato de venda 1, OPs 5, MES 1, P.I. 20, embarques 7, e-mails 66, decisões pendentes 24, gatilhos 53 pendentes / 95 ok |

Consultas usadas: `pg_policies`, `has_table_privilege`, `pg_get_functiondef`, `pg_trigger`, `pg_constraint`, `information_schema.columns`, `cron.job` + `cron.job_run_details`, `net._http_response`, `supabase_migrations.schema_migrations`, contagens agregadas e o `get_advisors(security)`. Nenhum dado pessoal foi extraído.

---

## G. Cobertura E2E

| Métrica | Valor |
|---|---:|
| Telas identificadas | 96 (83 internas + 13 públicas) |
| Investigadas em profundidade (código + dados) | 45 |
| Leitura parcial | 31 |
| Não investigadas além do smoke test | 20 (CRM ×4, NCM ×3, gi-painel, gi-analise-precos, pedidos-acompanhamento, art, cronograma, databook, handover, central-documentos, eng-configurador, desenho-tecnico, comissoes, logs, configuracoes) |
| Testadas com clique real nesta auditoria | 0 (escrever em produção era proibido; o fluxo não foi exercitado em ambiente isolado com dados) |
| Testes automatizados executados | 616/616 unitários (Node 22). O E2E Playwright não foi rodado nesta sessão; a análise é do código dele (E2E-043). |
| Teste local isolado | `server.js` com as versões do lock (E2E-041) |

Funcionalidades declaradas **NÃO TESTADAS** (exigiriam gravação real): assinatura pública ponta a ponta, envio de e-mail/WhatsApp, baixa e requisição no Omie, aprovação de decisões, geração de OP/MES, conversão Solicitação → Ficha.

---

## H. Matriz de riscos (P0/P1)

| Pos. | ID | Impacto | Confiança | Por que nessa posição |
|---:|---|---|---|---|
| 1 | E2E-001 | Aprovar compra, assinar, pagar e mudar preço sem login | Comprovado (banco) | Anula todas as travas de negócio |
| 2 | E2E-002 | Carteira de clientes e e-mails legíveis | Comprovado (banco) | Vazamento de dado pessoal e comercial |
| 3 | E2E-004 | Escrita real no estoque/compras do Omie | Comprovado | ERP é sistema de registro fiscal |
| 4 | E2E-003 | Identidade forjada | Comprovado | Torna alçadas e auditoria inúteis |
| 5 | E2E-005 | Salários expostos | Comprovado | Dado sensível de RH |
| 6 | E2E-009 | Compra na China sem os três avais | Comprovado | Risco financeiro direto (sinal ao fornecedor) |
| 7 | E2E-012 | Preço abaixo da política sem o CEO | Comprovado | Margem |
| 8 | E2E-013 | Câmbio errado em cotação não-USD | Comprovado | Preço de venda errado |
| 9 | E2E-019 / E2E-022 / E2E-020 | Parcela final liberada; contrato alterado após assinado | Comprovado | Jurídico e financeiro |
| 10 | E2E-011 | Proposta/aval com R$ 0 | Comprovado (3 casos) | Decisões e contratos com valor errado |
| 11 | E2E-016 / E2E-017 | NF e SLA travados; MES contornável | Comprovado | Faturamento atrasado |
| 12 | E2E-015 | Efeitos da assinatura perdidos | Comprovado | Linha do tempo e decisões incompletas |
| 13 | E2E-018 | Requisição duplicada no Omie | Comprovado (código) | Compra em dobro |
| 14 | E2E-006 | Phishing por WhatsApp oficial | Comprovado (código) | Reputação e segurança |
| 15 | E2E-010 / E2E-014 / E2E-023 / E2E-007 | Pendências somem; visibilidade errada; vistoria forjável; recuo mascara recusa | Comprovado | Operacional |

---

## I. Plano de prioridades (orientação, nada foi executado)

1. **Semana 0, segurança mínima:**
   - Não gravar identidade sem validação do token (E2E-003).
   - Exigir JWT de usuário + alçada no servidor em `pcp-omie-escrever`, `pcp-hh`, `whatsapp-notify` e `publicar_ficha_omie` (E2E-004/005/006).
   - Revogar `anon` de `fluxo_pendentes_*` (E2E-015).
   - Normalizar o caminho no `server.js` (E2E-041).
2. **Fase 4 do #571, por ondas:**
   - Remover o recuo para a chave pública (E2E-007).
   - Levar todos os perfis para o modo `on`.
   - Fechar `decisoes_gerenciais`, `avais_*`, `*_signatarios`, `contrato_instalador_parcelas`, `contratos_instalador`, `propostas`, `precificacoes_elevador`, `clientes` e `emails_projeto` (E2E-001/002).
   - Mover para RPC por token as escritas públicas que restam (vistoria, diário, status, termo) (E2E-022/023).
3. **Integridade comercial:**
   - Parse correto do valor na proposta automática e correção das 3 propostas (E2E-011).
   - Margem calculada sobre o preço da proposta e sem aceitar rascunho (E2E-012).
   - Moeda do fornecedor (E2E-013), dono da proposta (E2E-014) e coluna `atualizado_em` (E2E-024).
4. **Motor de gatilhos:**
   - `garantirNo` não deve fechar nó aberto nem pular `requerEventos` (E2E-009/010).
   - Replay de eventos passados ao nascer um nó (E2E-025).
   - Emitir os eventos ausentes (E2E-026) e alinhar `_evt_modulo_etapa` (E2E-027).
   - Corrigir `IMS_CONTRATADO` (E2E-038).
5. **Produção:**
   - Concluir a OP-mãe quando todas as frentes terminarem (E2E-016).
   - Travas do MES no banco (E2E-017).
   - Unicidade/transação na geração de OP (E2E-028).
   - Idempotência das requisições de varejo (E2E-018).
6. **Contratos e obra:**
   - Travar `updateFormState` pós-assinatura (E2E-020).
   - Trava de etapa no dossiê (E2E-019).
   - Termo, vistoria e vínculos do dossiê (E2E-032 a 035).
7. **Higiene:**
   - Trazer ao repo a DDL das migrations aplicadas (E2E-040).
   - Apagar ou versionar as Edge Functions órfãs (E2E-039).
   - Fixar versão e SRI do supabase-js (E2E-042).
   - Gate de CI no deploy, testes de RLS e do motor de eventos (E2E-043).

---

## J. Parecer final

1. **O sistema está apto a operar?** Sim, para uso interno de boa-fé: os fluxos rodam e a automação do banco está estável. **Não** está apto como sistema de controle: aprovações, assinaturas, pagamentos e escrita no Omie não são protegidos no servidor, e o site com a chave pública é acessível na internet.
2. **Fluxos com funcionamento comprovado:**
   - sincronizações Omie → PCP/Varejo (crons e logs ok);
   - Importação Varejo (carga, sugestão, contagem);
   - leitura de e-mail (cron, 96% de sucesso);
   - assinatura pública por RPC com finalização atômica no servidor;
   - abertura automática dos avais na aprovação da proposta;
   - trava de NF na expedição;
   - baixa de produção idempotente;
   - integridade referencial das ligações conferidas.
3. **Processos comprometidos:** proposta automática (valor 0), alçada de margem do CEO, cotações não-USD, trava de compra da P.I., conclusão MES → NF, liberação de parcelas do instalador, imutabilidade do contrato assinado, efeitos pós-assinatura quando ninguém está logado.
4. **Atenção imediata:** E2E-001, 002, 003 e 004 (e 005/006 junto).
5. **Nota geral:** **4,8 / 10.**
6. **Por quê:** a funcionalidade e a automação valem mais de 6, mas segurança (1,5, peso 12%) e herança entre telas (4,5, peso 15%) puxam a nota para baixo com defeitos comprovados, não hipotéticos.
7. **O que impede 9 ou 10:** autorização real no banco e nas Edge Functions; identidade verificada; motor de gatilhos que não fabrique conclusões; herança de valor, moeda e quantidade sem perdas; testes que exercitem RLS e fluxos com banco real (não simulado); banco reproduzível a partir do git.
8. **Confiança da avaliação:** média-alta. Segurança e banco foram lidos no catálogo de produção. Os defeitos de fluxo foram comprovados no código, e vários confirmados por contagens (E2E-011, 024, 039, 040). A ressalva é que nenhum fluxo foi clicado de ponta a ponta, por ser proibido escrever em produção.
