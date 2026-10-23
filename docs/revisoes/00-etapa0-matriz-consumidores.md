# Revisões comerciais (VP-SPEC-990-REV-001) — Etapa 0

Data: 22/10/2026. Só leitura; nenhuma migration, nenhum código de produto alterado.
Decisões do responsável (22/10): (1) toda atualização consome letra, nunca sobrescreve; (2) cliente pode aprovar e depois pedir revisão — deve estar previsto; (3) vale para todas as propostas (elevador, escada, esteira); (4) pedido de revisão por e-mail/WhatsApp pode ser registrado à mão.

## 1. Fatos confirmados no banco (22/10)
- `propostas`: 331 linhas (301 enviada, 22 rascunho, 4 visualizada, 3 aprovada, 1 revisao_solicitada). Nenhuma duplicidade por (numero_cotacao, proposal_type).
- Únicos: `numero_documento`, `numero`, `token`. `CHECK` de status: rascunho, enviada, visualizada, aprovada, recusada, expirada, cancelada, revisao_solicitada.
- Sem coluna de família/índice de revisão/proposta-base. Colunas `revisao_*` existentes = pedido do cliente + decisão, na MESMA linha.
- Triggers em `propostas`: `trg_avais_abrir_na_proposta` (AFTER INSERT/UPDATE OF status — abre Aval Financeiro + Jurídico + alerta quando vira `aprovada`) e `vp_valores_guarda`.
- Funções que tocam `propostas`: `_pp_efeitos`, `public_proposta_{obter,visualizada,assinar,recusar,revisao}` (página pública `/assinar`, por token).
- `precificacoes_elevador`: `numero_documento` UNIQUE; FK `cotacao_fornecedor_id` (SET NULL) e `formulario_elevador_id` (CASCADE).
- Caso 990: `VPPR-0990` rascunho, v1, nunca enviada; `VPPC-0990` finalizada ligada à RFQ original; RFQ `-A` visualizada sem resposta; RFQ `-B` respondida em 22/10.

## 2. Matriz de consumidores de `propostas`
Risco = o que acontece quando existirem 2+ revisões para o mesmo `numero_cotacao`.

| # | Arquivo | Como lê | Risco com revisões | Ajuste previsto |
|---|---|---|---|---|
| 1 | `proposta-store.js › salvar` | busca duplicata por (cotação, tipo), recusa | **Bloqueia a revisão** | Exceção controlada: só a RPC de criar revisão ignora; duplicata real continua barrada |
| 2 | `proposta-store.js › publicar/markSent` | sobrescreve `versao_publicada`, sobe `version` | Perde o que o cliente viu | Enviada/publicada vira imutável; mudança = nova revisão |
| 3 | `proposta-store.js › solicitarRevisao/decidirRevisao` | campos na própria linha | Só cabe 1 pedido por proposta | Tabela `proposta_solicitacoes_revisao`; campos antigos viram legado |
| 4 | `precificacao-elevador-store.js:930 criarPropostaAutomatica` | `.eq(numero_cotacao).maybeSingle()` | **Erro com 2+ linhas** | Checar só a revisão 0 / "existe alguma" com `limit(1)` |
| 5 | `instalacao-obra-store.js:230` | `.eq(numero_cotacao).maybeSingle()` → contrato | **Erro com 2+ linhas** | Usar a revisão vigente |
| 6 | `precificacao.jsx:537 carregarProntas` | conjunto de cotações com proposta | Sem problema (Set) | — |
| 7 | `precificacao.jsx:507` lista de Propostas (limit 300) | 1 linha por proposta | Revisões viram linhas soltas | Agrupar por família, mostrar código da revisão |
| 8 | `decisoes-store.js:419` contexto da cotação | pega a mais recente (`updated_at`, limit 1) | Pode pegar rascunho de revisão | Usar a vigente |
| 9 | `decisoes.jsx:194` "Ver documento" (blindada) | a mais recente por cotação | Abre a revisão errada | Resolver por id da revisão; manter `setSubsel`+`setRoute` |
| 10 | `aval-financeiro-store.js:90` e `aval-juridico-store.js:109` filas | todas `aprovada`, cria aval por proposta | **Aval duplicado** por revisão aprovada | Aval por (cotação, revisão) com regra de substituição (ver §3) |
| 11 | trigger `trg_avais_abrir_na_proposta` | ao virar `aprovada` | Reabre avais e alerta de novo | Considerar revisão; não reabrir o que já está OK |
| 12 | `contrato-venda-store.js:235` fila "aguardando contrato" | todas `aprovada` sem contrato | Original e revisão aprovadas aparecem as duas | Só a revisão vigente aprovada |
| 13 | `contrato-venda.jsx:102`, `contrato-instalador.jsx:458` | seletor (50/200 últimas) | Revisões poluem o seletor | Rotular com revisão; preferir vigente |
| 14 | `comissionamento-store.js:53` | todas `aprovada` sem comissão | **Comissão em dobro** | Só a vigente |
| 15 | `dossier-store.js` (`criarDeProposta`, `proposta_id`) | por cotação (idempotente) | Dossiê aponta p/ revisão antiga | Atualizar vínculo para a vigente, sem criar 2º dossiê |
| 16 | `projeto-elevador-store.js:114` equipamentos | soma `ativos` de todas as propostas da cotação | Equipamentos repetidos/de revisão antiga | Usar a vigente |
| 17 | `supabase.js:225` Dashboard, `notificacoes-lidas-store.js:76` | todas as propostas | Contagem/valor em dobro | Filtrar só vigentes |
| 18 | `public_proposta_*` + `assinar-app.jsx` (blindada) | por token | Hoje seguro (token por linha) | Cada revisão tem token/snapshot próprios; aviso "existe versão mais nova" |
| 19 | `gatilhos-engine.js` / `eventos-fluxo-store.js` | eventos por `numero_cotacao` | Linha do tempo mistura revisões | Evento carrega código da revisão |
| 20 | `controle-cotacoes.jsx` | agrupa por cotação | Não mostra revisões | Linha por família com expansão |

Observação: ~57 arquivos usam `PropostaStore`; a lista acima cobre os 18 que consultam a tabela direto. A Etapa 2 inclui varrer os 39 restantes por uso de `.numero_cotacao` / `getByNumeroCotacao`.

## 3. Decisão 2 — cliente aprova e depois pede revisão (proposta de regra)
Estado hoje: aprovada = trava tudo (avais, dossiê, decisão do CEO, comissão, fila de contrato). Não há caminho para revisar depois de aprovada.

Regra sugerida (a confirmar):
1. A revisão sempre nasce como **novo documento** (`990-A`), em rascunho, ligado à base (`proposta_base_id`). A aprovada original **permanece aprovada e intacta**.
2. A revisão tem **estado de vigência**: `vigente` (a que vale para o processo) ou `historica`. Só uma vigente por família.
3. **Antes de existir contrato assinado**: ao o cliente aprovar a revisão `990-A`, ela vira a vigente; a original passa a "substituída" (continua consultável). Avais/dossiê/comissão passam a olhar a vigente; avais já concedidos são **reavaliados** (se valor/escopo mudou, Financeiro e Jurídico reconfirmam; se só texto, mantêm).
4. **Com Contrato de Venda assinado**: a revisão **não** substitui automaticamente. Vira "revisão pendente de aditivo": o Jurídico decide entre aditivo ao contrato ou novo contrato. O contrato assinado continua apontando para a proposta que o originou.
5. **Com compra ao fornecedor já iniciada**: aviso obrigatório à Importação antes de aprovar a revisão (custo/equipamento pode já estar comprado).
6. Aprovar uma revisão nunca apaga decisões já tomadas (CEO, avais): elas ficam no histórico da revisão anterior.
7. Pedido do cliente após aprovação entra pela mesma solicitação de revisão (§ tabela nova) e exige decisão interna (aceitar/recusar) como já existe.

## 4. SQL de diagnóstico corrigido (somente leitura)
```sql
-- propostas da cotação (colunas reais: criado_em, sent_at, publicado_em)
select id, numero, numero_documento, status, version, precificacao_id,
       sent_at, publicado_em, criado_em
from public.propostas where numero_cotacao = 990 order by criado_em;

select numero_documento, revisao, status, sent_at, responded_at
from public.cotacoes_elevador_fornecedor
where formulario_elevador_id = 'FE-MV86EUBZ' order by created_at;

select numero_documento, status, cotacao_fornecedor_id, aprovado_em
from public.precificacoes_elevador where numero_cotacao = 990 order by created_at;
```

## 5. Achado extra
`VPPC-0990` está ligada à RFQ original; a RFQ `-B` respondeu em 22/10 e não alimenta nenhuma precificação. Tratar à parte (nova precificação), independente desta especificação.

## 6. Pendências para fechar a Etapa 0
- Confirmar a regra do §3 (principalmente itens 3, 4 e 5).
- Confirmar que revisão de escada/esteira segue a mesma regra (decidido: sim).
