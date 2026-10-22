# Revisões comerciais — Etapa 1: desenho do banco e das RPCs (somente papel)

Data: 22/10/2026. **Nada aplicado.** Nenhuma migration, nenhum código. Este arquivo é o contrato para a migration da Etapa 1 (a ser escrita só depois do "pode seguir" do responsável).
Base: `00-etapa0-matriz-consumidores.md` + decisões do responsável de 22/10.

## 0. Decisões que moldam o desenho
1. **Toda atualização de proposta já enviada gera letra nova.** Nunca se edita nem se republica por cima. (Muda o papel do "destravar": ver §6.)
2. **Aprovada ≠ encerrada.** O cliente pode pedir revisão depois de aprovar. Hoje isso é impossível: `public_proposta_revisao` só aceita `enviada`/`visualizada` e devolve `status_aprovada`.
3. **A versão antiga não é só histórico**: o cliente pode querer voltar. Para reenviá-la, **o Gestor precisa liberar** (destravar com motivo) e só então o Vendedor reenvia. Reenvio do mesmo documento **não consome letra** (RN-018); qualquer mudança de conteúdo consome.
4. **Pedidos de revisão têm trilha**: Comercial, Financeira, Técnica e Jurídica (do cliente ou de terceiros do cliente). Várias pessoas diferentes do cliente podem pedir ao mesmo tempo, e uma revisão nossa pode atender vários pedidos. Revisão dentro da etapa de aprovação (antes de aprovada) também existe: `990-A` pode gerar `990-B`.
5. Vale para elevador, escada e esteira. Pedido registrado à mão (e-mail, WhatsApp, reunião) é permitido.

## 1. Modelo conceitual
- **Família** = `(numero_cotacao, proposal_type)`. Sem tabela de família (já é a chave natural e já não há duplicidade). Propostas sem `numero_cotacao` (legado) ficam fora do índice de família e continuam únicas.
- **Revisão** = uma linha de `propostas`. Original = `revisao_indice 0`, sem letra. Revisões `-A`, `-B`, … `-Z`, `-AA` (mesmo algoritmo de `MasterIdEngine.proximaRevisao`; `parseNumeroCotacao('VPPR-0990-A')` já devolve 990).
- Três eixos independentes (Art. 5): letra da proposta, letra da RFQ do fornecedor, `version` de publicação. Nenhum deduz o outro; o vínculo é explícito (`precificacao_id` → `cotacao_fornecedor_id`).

## 2. Alterações em `propostas` (aditivas; todos os existentes ficam `revisao_indice 0`, `vigencia 'vigente'`)
| Coluna | Tipo | Observação |
|---|---|---|
| `revisao_indice` | int NOT NULL DEFAULT 0 | 0 = original |
| `revisao_codigo` | text NULL | NULL na original; 'A','B',…,'AA' |
| `proposta_raiz_id` | uuid NULL → propostas(id) | original da família (NULL na própria original) |
| `proposta_base_id` | uuid NULL → propostas(id) **ON DELETE RESTRICT** | de qual documento esta nasceu (pode ser a original → gera C) |
| `revisao_motivo` | text NULL | obrigatório ≥10 letras na criação |
| `vigencia` | text NOT NULL DEFAULT 'vigente' | CHECK: `vigente`, `em_negociacao`, `historica`, `pendente_aditivo` |
| `substituida_em` / `substituida_por_id` | timestamptz / uuid | quando e por qual perdeu a vigência |
| `reativada_em` / `reativada_por` / `reativacao_motivo` | | liberação do Gestor para reenviar |
| `criada_por` | text | e-mail de quem criou a revisão |
| `idempotency_key` | text NULL UNIQUE | evita 2 letras por retry |
| `snapshot_origens` | jsonb | precificação, cotação do fornecedor, câmbio e hash do que a revisão herdou |

Índices/constraints:
- `UNIQUE (numero_cotacao, proposal_type, revisao_indice) WHERE numero_cotacao IS NOT NULL` — viável hoje (zero duplicidade).
- `UNIQUE (numero_cotacao, proposal_type) WHERE vigencia = 'vigente' AND numero_cotacao IS NOT NULL` — uma só vigente por família.
- Os `UNIQUE` existentes (`numero`, `numero_documento`, `token`) ficam. Revisão nova ganha `numero` novo da sequência, `numero_documento` = documento da original + `-` + letra (ex.: `VPPR-0990-A`) e **token novo**.
- Guarda de exclusão (trigger): não apaga proposta com `sent_at` preenchido nem com revisões filhas (hoje `PropostaStore.excluir` faz DELETE físico e `proposta_itens`/`contract_drafts` caem em cascata).
- O CHECK de `status` **não muda**: a revisão carrega o próprio status (rascunho/enviada/…); "substituída" é `vigencia`, não status. Assim filtros antigos por `status='aprovada'` continuam compilando — o que quebra é a semântica, tratada na Etapa 2 pela view `propostas_vigentes`.

## 3. Vigência — quem manda na família
| Situação | Efeito |
|---|---|
| Proposta nasce | `vigente` |
| Revisão criada (rascunho) | `em_negociacao`; a anterior mantém a vigência |
| Revisão **enviada** e ninguém aprovou ainda | a revisão enviada vira `vigente`; as anteriores não aprovadas viram `historica` (link continua abrindo, com aviso "existe versão mais recente"; **não pode ser assinada**) |
| Cliente **aprova** uma revisão, sem Contrato de Venda assinado | ela vira `vigente`; a aprovada anterior vira `historica` (permanece aprovada, intacta) |
| Cliente aprova uma revisão **com Contrato assinado** | `pendente_aditivo`; o contrato segue apontando para a proposta que o originou; Jurídico decide aditivo ou novo contrato |
| **Gestor reativa** uma revisão histórica | ela volta a `vigente`; a vigente atual vira `historica`; bloqueado se houver contrato assinado em outra revisão (vai ao Jurídico) |
| Revisão recusada/cancelada/expirada | vira `historica`; a família volta à última aprovada ou à última enviada |
A função única `proposta_aplicar_vigencia(p_numero_cotacao, p_tipo)` aplica estas regras e é chamada pelas RPCs e por trigger em mudança de `status`. É o que os consumidores da Etapa 0 passam a usar via view `propostas_vigentes`.

## 4. Tabelas novas (todas nascem **fechadas**, regra do #571)
Leitura: `authenticated` + `vp_usuario_ativo()`. Escrita: **somente** RPCs `SECURITY DEFINER`. Página pública: só via `public_*`.

**4.1 `proposta_solicitacoes_revisao`** — substitui os campos `revisao_*` únicos (que ficam como legado para não quebrar gatilhos/telas).
`id`, `proposta_id` (a revisão **exata** que o cliente viu), `numero_cotacao`, `trilha` CHECK (`comercial`,`financeira`,`tecnica`,`juridica`,`outra`), `origem` CHECK (`link_publico`,`email`,`whatsapp`,`reuniao`,`manual`), `solicitante_nome`, `solicitante_papel` (ex.: advogado do cliente, engenheiro), `solicitante_contato`, `texto`, `anexos` jsonb (prova), `versao_vista` + `hash_visto`, `status` CHECK (`aberta`,`em_analise`,`precisa_informacao`,`aceita`,`recusada`,`atendida`), `decidida_em/por`, `motivo_decisao`, `proposta_resultante_id` (várias solicitações podem apontar para a mesma revisão), `registrada_por` (quando manual), `created_at`.
Backfill: a única linha com `revisao_solicitada_em` (1 hoje) vira 1 solicitação `origem link_publico`, `trilha outra`.

**4.2 `proposta_revisao_validacoes`** — liberação interna por trilha antes de enviar a revisão: `proposta_id`, `trilha`, `status` (`pendente`,`validada`,`dispensada`), `por`, `em`, `justificativa` (obrigatória na dispensa — RN-010). Quais trilhas são exigidas = trilhas das solicitações atendidas + trilhas afetadas pelo diff (Etapa 2). Mapa: financeira → Financeiro (nova precificação), técnica → Engenharia (ficha/fornecedor), jurídica → Jurídico, comercial → Gestor comercial.

**4.3 `proposta_envios`** — `proposta_id`, `canal`, `destinatario` (minimizado), `enviado_por`, `enviado_em`, `resultado`, `hash_publicado`, `reenvio boolean`, `reativacao boolean`. (O `log` jsonb atual continua; não se faz backfill.)

**4.4 `proposta_eventos`** — append-only: `id`, `numero_cotacao`, `proposta_id`, `evento`, `ator_email`, `ator_papel`, `origem`, `payload` jsonb (sem PII desnecessária), `correlation_id`, `idempotency_key` UNIQUE, `at`. Sem UPDATE/DELETE. Eventos: solicitação criada/decidida, revisão criada/publicada/enviada, validação, reativação, vigência alterada.

## 5. RPCs (SECURITY DEFINER, `search_path=public`, só `authenticated`; conferem alçada dentro)
1. `proposta_proxima_letra(text)` — porte do `proximaRevisao` (A…Z, AA…).
2. `proposta_criar_revisao(p_base_id, p_motivo, p_solicitacoes uuid[], p_idempotency_key)`:
   - lock `pg_advisory_xact_lock(hashtext('proposta:'||numero_cotacao||':'||tipo))` → próximo índice/letra sem corrida; retry com a mesma chave devolve a mesma revisão.
   - base precisa estar fora de `rascunho` (rascunho se edita). Pode ser **qualquer** revisão da família, inclusive a original (gera C).
   - copia o conteúdo publicado da base (ou `data_json`); **zera** token, assinatura, audit, envio, publicação, destrave, `revisao_*`; reescreve `numero`/`masterId`/título dentro do `data_json`; guarda `snapshot_origens`.
   - vincula as solicitações escolhidas (`proposta_resultante_id`, status `atendida` só ao enviar).
   - quem pode: dono da família (vendedor) ou alçada `propostas.criar_revisao`.
3. `proposta_reativar_revisao(p_id, p_motivo)` — alçada nova `propostas.reativar_revisao` (nasce com os mesmos titulares de `destravar_aprovada`: Gestor; Administrador sempre). Motivo ≥10 letras. Aplica §3, **renova a validade** (`expires_at = now() + validade_dias`, registrado em evento) e registra `reativada_*`. **Não libera edição de conteúdo.** Depois o Vendedor usa o "Reenviar" normal, que passa a exigir `vigencia IN ('vigente','em_negociacao')`.
4. `proposta_registrar_solicitacao(p_proposta_id, trilha, origem, solicitante…, texto, anexos)` — para pedido recebido fora do site (e-mail/WhatsApp/reunião), com anexo de prova; **nunca** simula visualização.
5. `proposta_decidir_solicitacao(p_id, decisao, motivo)` — aceitar/recusar/pedir informação.
6. `proposta_validar_trilha(p_proposta_id, trilha, status, justificativa)`.
7. `public_proposta_revisao(token, texto, trilha, nome, papel, contato)` — **sobrecarga nova**; a de 2 parâmetros fica (navegadores com cache antigo). Mudanças de regra: aceita também `aprovada` (e `recusada`/`expirada` se vigente), **sem trocar o status** nesse caso; grava na tabela 4.1; mantém escrever os campos legados enquanto houver consumidores antigos. *(Área blindada de assinatura: confirmo com o responsável antes de aplicar.)*
8. `proposta_aplicar_vigencia(numero_cotacao, tipo)` (interna) + view `propostas_vigentes`.

Concorrência e idempotência: advisory lock por família + `idempotency_key` UNIQUE + índice único `(familia, revisao_indice)` como última barreira.

## 6. Impactos que mudam comportamento existente
- **"Destravar proposta enviada para editar" deixa de ser o caminho.** Hoje o Líder destrava e o vendedor altera a proposta enviada no próprio registro. Pela decisão 1, isso vira "criar revisão". O destrave atual continua útil só como base da alçada de **reativação** (§5.3). Texto das telas e a trava `STATUS_TRAVADOS` serão ajustados na Etapa 3.
- **Imutabilidade por trigger** (bloquear UPDATE de `data_json`/`versao_publicada`/valores de proposta enviada): **não entra na Etapa 1.** Há escritores legítimos (`public_proposta_assinar` troca valores da modalidade 120/90; `publicar`; `salvar`). Entra em modo "observar" (só registra) na Etapa 2 e liga depois de mapeados.
- Avais: `fn_avais_abrir_na_proposta` cria avais por `proposta_id` (`ON CONFLICT (proposta_id)`); sem ajuste, uma revisão aprovada abriria avais duplicados para a mesma cotação. Regra a desenhar na Etapa 2: herdar o status dos avais da revisão anterior quando valor/escopo não mudou; reabrir só o que mudou.
- Feature flag: com zero revisões criadas o sistema se comporta **igual a hoje** (tudo `vigente`, índice 0). A UI de revisão fica atrás de flag; as RPCs podem existir no banco sem uso.

## 7. Backfill e rollback
- Colunas com `DEFAULT` constante (sem reescrever a tabela); 331 propostas → índice 0/`vigente`; 1 solicitação migrada.
- Rollback: tabelas e colunas novas não são lidas pelo código atual; reverter = desligar a flag e (se preciso) `DROP` das estruturas novas sem tocar nos dados antigos. Nenhuma coluna existente é alterada ou removida.
- Pré-requisitos antes da migration: `SELECT` de verificação de duplicidade por família (feito: 0), cópia de `vp_policy_backup` não se aplica (tabelas novas).

## 8. Plano de testes SQL (Etapa 4, em `supabase/tests/`)
Letras (A…Z, AA); duas criações simultâneas na mesma família; retry com mesma chave; criar a partir da original após A e B (gera C); transições de vigência (todas as linhas de §3); pedido de revisão em proposta `aprovada` sem trocar status; reativação sem alçada (nega), com contrato assinado em outra revisão (nega), com sucesso; exclusão barrada; RLS: anon sem acesso, usuário ativo lê, ninguém escreve direto; backfill idempotente.

## 9. Pendências de decisão
1. **Aprovação da revisão quando já há Contrato assinado**: quem decide o aditivo? Proposta padrão: **Jurídico** decide; **Financeiro** também quando valor muda; Gestor comercial só reativa/envia. (Responsável ainda não respondeu esta pergunta.)
2. **Reativação renova a validade e mantém o mesmo link/token?** Proposta: sim, mesmo token, validade renovada e registrada; se preço/câmbio precisar mudar, obrigatoriamente vira nova letra.
3. **Alinhamento do cliente por trilha** (cliente "OK" em comercial/financeiro/técnico/jurídico, informativo, sem substituir a assinatura): fica para a Etapa 3 se o responsável quiser.
