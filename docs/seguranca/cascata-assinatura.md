# Cascata da assinatura de Proposta (`/assinar/:token`) — o que é gravado e por quem (04/10/2026)

Levantamento da Task 9/10 do plano #571. **Hoje** tudo abaixo roda no navegador do cliente com a chave pública; a Task 10 move a coluna "navegador" para o servidor.

## Já passou para o servidor (Task 9, migration `20261004200000_public_proposta_rpc.sql`)
| Ação | Função do banco | O que ela grava em `propostas` |
|---|---|---|
| Abrir o link | `public_proposta_obter(token)` | só lê o registro daquele token |
| Visualizar | `public_proposta_visualizada` | `status→visualizada` (só se estava `enviada`), `viewed_at`, `audit` (viewedAt/viewIp do **servidor**/UA/dispositivo), `log` |
| Assinar | `public_proposta_assinar` | `status→aprovada`, `signed_at`, `aprovada_em`, `audit` (signedAt/signIp do **servidor**, nome, tipo/dados da assinatura, hash, versão), `log`; com 2 modalidades: troca `data_json`/`versao_publicada` e `valor_total` (regra 120×90 espelhada em SQL) |
| Recusar | `public_proposta_recusar` | `status→recusada`, `audit` (refusedAt/By/Reason/IP), `log` |
| Pedir revisão | `public_proposta_revisao` | `status→revisao_solicitada`, `revisao_texto`, `revisao_solicitada_em`, `log` |

Regras no servidor: só aceita **enviada/visualizada** (assinar de novo → `status_aprovada`; recusar depois de assinada → `status_aprovada`), exige nome, exige escolha 120/90 quando há as duas modalidades, bloqueia proposta expirada, e **só chaves conhecidas** entram na auditoria vinda do navegador (status/valores nunca).
Interruptor de emergência no navegador: `localStorage.vp_public_rpc = 'off'` volta ao caminho antigo. Se a RPC falhar, a loja cai sozinha no caminho antigo (só funciona enquanto as tabelas estiverem abertas — Fase 4).

## AINDA no navegador do cliente (Task 10) — mantêm `eventos_fluxo`, `alertas`, `gatilhos`, `decisoes_gerenciais`, `dossier_obra`, `leads`, `clientes` abertos a `anon`
Depois de `public_proposta_assinar` (`markSigned` em `src/proposta-store.js`):
1. `pushNotification` → `alertas` (insert) + `vp_logs` (`VPLog.registrar`) — também em visualizada/recusada/revisão.
2. `EventosFluxo.registrar('CLIENTE_RESPONDEU_PROPOSTA')` → `eventos_fluxo` + `GatilhosEngine.onEvento` (cria/fecha linhas em `gatilhos`; calcula SLA).
3. `DecisoesStore.podeComprarEquipamento(numero_cotacao)` → `decisoes_gerenciais` (decisão `compra_equipamento_ceo`, só quando margem < 15% ou desconhecida) + alertas.
4. `window.__DOSSIER.criarDeProposta(updated)` → `dossier_obra` (idempotente por Nº de cotação).
5. Lead → `Convertido` (`leads`) e `CadastrosClientesStore.criarOuVincularDeLead` → `clientes`.
Já no banco (trigger, não depende do navegador): `fn_avais_abrir_na_proposta` (2 avais + alerta "avais iniciados") e `fn_avais_notificar_ok`.

## Task 10 (05/10/2026) — a cascata saiu do navegador do cliente
Migration `20261005100000_fluxo_pendentes_proposta.sql`:
- **Aviso e auditoria no banco** (mesma transação da ação do cliente): `_pp_efeitos` grava `alertas` + `vp_logs` com os mesmos textos de antes (visualizada/assinada/recusada/revisão). Falha do aviso nunca derruba a ação do cliente.
- **Fila `fluxo_pendentes`** (sem política para anon/authenticated — só as RPCs `fluxo_pendentes_reivindicar` / `fluxo_pendentes_concluir`). Assinada, recusada e pedido de revisão enfileiram; **assinada é única por proposta** (índice parcial).
- **Quem executa a cascata:** `src/fluxo-pendentes.js`, num usuário **interno logado** (a cada 30 s e ao voltar à aba; não roda em localhost salvo `vp_fluxo_dev=1`; desligável com `localStorage.vp_fluxo_pendentes='off'`). Roda o **mesmo código de antes** (`PropostaStore.executarEfeitosAssinatura` + `EventosFluxo.registrar`) — o motor de Gatilhos (SLA em horas úteis) **não foi reescrito em SQL**, de propósito (risco de divergir). Reivindicação atômica (`FOR UPDATE SKIP LOCKED`, lease de 5 min, até 5 tentativas); item com problema vira `falhou` com o motivo em `fluxo_pendentes.erro`.
- **Consequências a saber:** (1) a cascata (eventos/gatilhos, decisão do CEO, dossiê, lead→cliente) acontece **quando alguém interno estiver com o sistema aberto** (normalmente em ≤ 30 s no horário comercial; fim de semana/madrugada espera) — os 2 avais e os avisos continuam imediatos; (2) o ator do evento é o **cliente** (`atorNome`), a decisão do CEO nasce **sem solicitante** (`contexto.origem_cliente`), o dossiê grava `created_by` = quem processou; (3) o momento (`nascido_em`/SLA) dos gatilhos é o do processamento, não o da assinatura.
- Fase 4: restringir `fluxo_pendentes_*` a `vp_usuario_ativo()` e remover o caminho antigo (fallback inline) de `proposta-store.js`.
- Teste (05/10): proposta descartável assinada pelo `PropostaStore` → fila `pendente`, alerta+log gravados, **0** escritas em eventos/gatilhos/decisões/dossiê; `FluxoPendentes.processar()` → evento com ator = cliente, cadeia de gatilhos, decisão do CEO sem solicitante, dossiê, fila `concluido`; reprocessar → 0; recusa e revisão idem. Tudo apagado depois.

## Teste da Task 9 (04/10/2026)
- SQL em transação desfeita: obter com token inválido → `null`; visualizar; assinar sem escolha → `escolha_obrigatoria`; assinar com `90` → `valor_total` 150000, `data_json` trocado, `opcao90` preservada, `opcaoEntrega=90` na auditoria; `status`/`valor_total` injetados no `p_audit` foram ignorados; reassinar e recusar depois → `status_aprovada`; trigger abriu os avais.
- Pelo app local (`PropostaStore` real, proposta descartável `TESTE-CLAUDE-RPC`, depois apagada com tudo que gerou): mesmo resultado; IP gravado vem do **servidor** (`x-forwarded-for`).
- **Não testado:** clique na tela `/assinar` (o painel do navegador de teste estava coberto/oculto); quem for validar deve abrir um link de proposta de teste pelo celular/outro navegador e assinar.
