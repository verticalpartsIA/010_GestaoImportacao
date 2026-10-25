# Evolução dos Equipamentos — qualidade dos dados e cobrança ao Felipe (24/10/2026)

Fluxo: CONSTITUTION (= CLAUDE.md) → SPECIFY → CLARIFY → PLAN → TASKS → ANALYZE → IMPLEMENT.
**Estado: SPECIFY e CLARIFY feitos. PLAN em diante aguardam as respostas abaixo. Nada foi alterado em código, banco ou gi-avisos.**

## SPECIFY — o que o sistema precisa fazer

1. A tela Mapa de Obras › Evolução só mostra o que foi registrado. Quem registra: **montadores** (Diário de Obra) e **Felipe Barros** (gestor, cadastro das datas/dados em `equipamentos_obra`, fase do dossiê, nº de série).
2. O sistema deve **detectar** dado incoerente ou parado (regras da seção "Achados") e **mostrar** na tela, com marca de "dado a conferir".
3. O sistema deve **cobrar o Felipe** por aviso (alerta → gi-avisos → WhatsApp), com a lista exata do que está pendente, sem repetir o que já foi cobrado e respeitando fins de semana/feriados (calendário `bloqueia_envio`).
4. A cobrança não corrige dado sozinha: só avisa. Quem corrige é o Felipe/montador.

## Achados da varredura (dados reais, 24/10/2026, só leitura)

Fontes varridas: `equipamentos_obra`, `dossier_obra.status_master`, `acompanhamento_obra_lancamentos` (Diário de Obra).

**A. Diário de Obra quase não é usado.** Das 20 obras em "Instalação", **16 têm zero lançamentos** (só 500.0338, 0339, 0375 e 0389 lançam). Por isso o progresso mostra 0%. É **falta dos montadores**, não falha do sistema.

**B. Data "real" no futuro do próprio registro (provável erro humano):**
- 500.0373: `data_real_termino` 01/09, mas o dossiê foi atualizado em 27/08 (digitou o fim antes de acontecer, ou a previsão foi gravada como real).
- 500.0378: chegada do material 17/10, mas o dossiê foi atualizado em 14/10. As irmãs 0377/0379 têm 17/07 → **provável mês errado (07 virou 10)**.

**C. Obra concluída mas fase não avançou:** 500.0373 e 500.0374 têm término real em 01/09 e continuam na fase "Instalação" (devia ir para DataBook/Entregue). Sem 50%/75% preenchidos.

**D. Previsões vencidas sem ninguém atualizar (parado há semanas):**
- 500.0372 (previsão de término 31/08, última edição 02/09), 500.0380 (31/08; 08/09), 500.0347 (04/10; 01/09), M063 Metro BH (27/08; 20/08), 500.0346 (19/09), 500.0365 (07/10), 500.0376 (29/09), 500.0338/0339 (24/09), 500.0311 (21/09), 500.0349 (29/09), 500.0389 (30/09).
- A tela só marca atraso na etapa atual; as previsões de término vencidas acima **não aparecem como atraso**.

**E. Previsão não replanejada depois de fato novo:** 500.0311 chegou na obra em 14/10, mas o início previsto continua 17/08. 500.0375 iniciou em 28/08 com início previsto 30/09. 500.0338 iniciou em 14/10 contra 25/08 previsto.

**F. Irmãos da mesma obra com preenchimento diferente:** 500.0338 tem início real (14/10), 500.0339 não, mas ambos têm Diário.

**G. Fase atrasada em relação aos dados:** 500.0349 (fase "Homologação instalador") já tem chegada do material (05/08) e previsão de término; os irmãos 0347 e 0348 estão em "Instalação".

**H. Cadastro incompleto:** M047 sem nº de série; M063 e M064 (Metro, escada de **remoção**) sem série e aparecem "Saiu da fábrica", que não se aplica a remoção; 500.0348 e 500.0333/0334 sem nenhuma previsão.

**I. Atualização em massa de 08/10:** ~25 equipamentos têm "última edição" 08/10 (carga), sem datas; não é erro, mas a data de edição não prova que alguém conferiu.

Observação de método: não conferi com os montadores nem com o Felipe; "provável erro humano" é inferência pelos dados.

## CLARIFY — o que preciso que você decida

1. **Escopo do Felipe:** cobrar só o que é cadastro/gestão (B, C, D, E, G, H) e deixar o Diário de Obra (A, F) para os montadores? Ou o Felipe também cobra os montadores (aviso lista quem não lança)?
2. **Frequência:** um resumo por dia útil às 09:30 (padrão do calendário) ou só semanal (segunda)? Reenvia o mesmo item todo dia ou só quando muda?
3. **Quando um item vira "cobrável":** previsão vencida há quantos dias? Obra em Instalação sem Diário há quantos dias (sugiro 3 dias úteis)?
4. **Cópia da cobrança:** só Felipe, ou também você/Cleiton/Maurício em cópia?
5. **Canal:** WhatsApp pelo gi-avisos (como os avisos do Contrato do Instalador) mais a Central de Notificações? O WhatsApp do Felipe já está cadastrado no mesmo lugar usado pelos outros avisos?
6. **Montadores:** devem receber cobrança direta (link do Diário) ou só passam pelo Felipe?
7. **Tela:** marcar "dado a conferir" no cartão (ícone + motivo) e passar a mostrar previsão vencida de **qualquer** etapa como atraso, ok?
8. **Correção de dados:** posso propor correções (ex.: 500.0378 → 17/07, avançar fase 0373/0374), mas **só você ou o Felipe autoriza**; nenhum dado será alterado por mim sem seu OK.

## CLARIFY — decisões fechadas (24/10/2026)

Decididas pelo Gelson: **1 resumo por dia útil às 09:30 ao Felipe, com cópia para o Gelson.** As demais foram resolvidas com o padrão sugerido (Gelson mandou seguir; pode mudar qualquer uma):

| # | Decisão |
|---|---------|
| 1 | O Felipe é cobrado pelo cadastro/gestão (B, C, D, E, G, H) **e** recebe a lista dos montadores sem Diário (A, F), para ele cobrá-los. |
| 2 | Um único resumo por dia útil, 09:30, só se houver pendência. A lista mostra tudo que continua pendente (é cobrança), em ordem de gravidade. |
| 3 | Previsão vencida há ≥ 1 dia útil. Obra em "Instalação" sem Diário há ≥ 3 dias úteis (ou nunca lançou, com chegada do material há ≥ 3 dias úteis). Registro vencido e sem edição há > 14 dias entra como "parado". |
| 4 | Cópia: `gelson.simoes@verticalparts.com.br` (e-mail do Gelson no sistema; **confirmar** se a cópia vai para este e-mail). |
| 5 | Canal: alerta na Central de Notificações + WhatsApp pelo gi-avisos (mesmo caminho do Contrato do Instalador). O gi-avisos já respeita fim de semana/feriado (`bloqueia_envio`). **Verificar o WhatsApp do Felipe** onde o gi-avisos lê (não achei no `colaboradores_vpsistema`; ele já recebe os avisos do contrato, então existe em algum lugar). |
| 6 | Montadores não recebem cobrança direta; passam pelo Felipe. |
| 7 | Tela: selo "dado a conferir" com o motivo, e previsão vencida de **qualquer** etapa passa a contar como atraso. |
| 8 | Nenhum dado é corrigido por mim sem autorização do Gelson/Felipe. |

## PLAN — como será construído

**Regras de detecção** (fonte única, em código puro testável): R1 data real no futuro da última edição do registro; R2 data real incompatível com a ordem das etapas (início antes da chegada etc.); R3 término real com fase ainda "Instalação"; R4 previsão de qualquer etapa vencida sem data real; R5 previsão não replanejada (data real muito anterior/posterior à prevista, > 14 dias); R6 obra em Instalação sem Diário (≥ 3 dias úteis); R7 equipamento sem nº de série ou escada de remoção marcada "saiu da fábrica"; R8 equipamentos da mesma obra com preenchimento divergente (um tem início real, outro não); R9 registro parado (> 14 dias) com previsão vencida.

**Peças:**
1. `src/evolucao-conferir-calc.js` (puro): implementa R1–R9 sobre as linhas já carregadas; devolve `{codigo, gravidade, motivo, equipamento, obra, quem}` onde `quem` = `montador` ou `felipe`.
2. Tela (`evolucao-equipamentos.jsx` / `-calc.js`): selo "dado a conferir" no cartão + atraso por qualquer etapa (ajuste em `montarLinha`/`ocorrencias`; sem mudar o que já aparece).
3. Banco (migration + cron, **exige CONFIRMO**): função `evolucao_alertar_felipe(simular)` que aplica as MESMAS regras em SQL e grava **1 alerta por destinatário por dia** (Felipe + cópia Gelson). Como o JS e o SQL são duas cópias, teste de paridade igual ao `alerta-pcp-paridade.test.js`.
4. Cron seg–sex 12:30 UTC (09:30 Brasília), só em dia útil (consulta `calendario_feriados`); sem pendência = não cria alerta; falha ao avisar nunca interrompe nada (padrão do repo).
5. Alerta: título único por dia ("Evolução dos equipamentos: N itens a conferir — dd/mm") porque o gi-avisos agrupa avisos de mesmo título em 24 h e só o primeiro chegaria (PR #1045). Texto com os 10 itens mais graves + "ver todos" levando a `/engenharia/mapa-obras/evolucao` (filtro `?conferir`). Id determinístico `evol-conf-<data>-<email>`.

## TASKS

1. Testes primeiro (TDD) de `evolucao-conferir-calc.js` com os casos reais do relatório (500.0373, 0378, 0372, 0311, 0374, M047, M063).
2. Implementar o módulo puro e ligar à tela (selo + filtro "Só a conferir").
3. Subir `?v=` de todos os arquivos tocados (`index.html`) e rodar `check-cache-bust`.
4. Migration `evolucao_alertar_felipe` + cron (**CONFIRMO**), com modo `simular`; rodar a simulação e comparar a lista com a do JS.
5. Teste de paridade JS × SQL.
6. Descobrir/confirmar o WhatsApp do Felipe e o e-mail da cópia; disparar **um** resumo de teste só para o Gelson antes de ligar para o Felipe.
7. Atualizar o CLAUDE.md (regra permanente: Felipe cobrado diariamente; origem dos dados da Evolução).

## ANALYZE — conflitos, lacunas e riscos

- **Cobrança agrupada pelo gi-avisos:** se o título repetir, só o 1º do dia chega. Mitigado com título único por dia; **testar com um envio real** (só para o Gelson).
- **Cópia ≠ duas mensagens iguais agrupadas:** destinatários diferentes têm ids diferentes; confirmar no gi-avisos que o agrupamento é por destinatário.
- **WhatsApp do Felipe não localizado** no cadastro consultado — pode estar noutra tabela/arquivo do gi-avisos; sem isso só a Central de Notificações funciona.
- **Falsos positivos:** previsão vencida em obra legítima parada (aguardando cliente) vai cobrar o Felipe sem motivo. Mitigação futura: campo "justificativa/pausa" (fora de escopo agora; **pergunta aberta**).
- **Carga de 08/10** deixou ~25 equipamentos sem data; eles entram em R6/R9 e podem gerar uma lista longa no 1º dia. Limitar o texto a 10 itens + link evita enxurrada.
- **Duplicação de regra** (JS e SQL): risco de divergir; coberto pelo teste de paridade.
- **Escopo vs. regras blindadas do CLAUDE.md:** não toca `send-email`/`read-inbox`, Atualização de Custos, Precificação ou assinaturas. O Mapa de Obras/Evolução não é área blindada; só se mexe em `evolucao-*` e uma migration nova.
- **Dados reais não são alterados:** nenhuma das tasks escreve em `equipamentos_obra`/`dossier_obra`.
- **Tutorial do Mapa de Obras** (`TreinamentoVP/obras-instalacao/mapa-de-obras`) fica desatualizado após a mudança de tela: avisar para regenerar, não editar à mão.

## IMPLEMENT — estado

**Tasks 1–3 feitas (24/10/2026, local, não commitado):** `src/evolucao-conferir-calc.js` (regras puras) + `src/evolucao-conferir-calc.test.js` (16 testes com os casos reais, escritos antes) + selo "Dado a conferir" no cartão e filtro "Só dado a conferir" em `evolucao-equipamentos.jsx` (v4→v5; script novo `?v=1` no `index.html`). `npm test` 797/797; cache-bust ok. Na tela real: 23 de 58 equipamentos marcados.

Limitações conhecidas: (a) "sem Diário" só detecta quem **nunca** lançou (o último lançamento não vem do `resumoProgressoBatch`; a Task 4 pode ler a data direto do banco); (b) "dias úteis" ignora feriados (só o aviso do gi-avisos os respeita); (c) a regra "real posterior à última edição" usa a edição mais recente entre o dossiê e o equipamento (`equipamentos_obra.atualizado_em`; corrigido após o achado do Codex no PR #1089, migration `20261024130000`) — com isso 500.0373 e 500.0378 deixaram de ser apontados por essa regra, mas 500.0378 continua apontado por "chegada destoa dos irmãos"; (d) a previsão vencida na tela de atraso (anel vermelho existente) continua só na etapa atual — o selo novo cobre as demais.

**Task 4 (migration + cron) e 6 (WhatsApp do Felipe) só com o seu "CONFIRMO"/definição.** Nada é commitado/subido sem pedido seu.

## PENDÊNCIA 4.3 — Pausa/justificativa para obra legitimamente parada (25/10/2026)

### SPECIFY
Obra parada de propósito (cliente pediu, falta liberação) hoje cobra o Felipe todo dia, igual a uma esquecida. Objetivo: registrar **"Pausada até dd/mm" + motivo**; enquanto a pausa vale, a obra sai da cobrança diária e do selo "Dado a conferir"; ao vencer, volta sozinha. Nada é apagado e a pausa fica no histórico.

### Onde mexer (levantado)
- Dossiê da Obra (`src/dossier-obra.jsx`, hoje já tem o botão "Editar endereço" → modal `DossierEnderecoModal`; mesmo padrão para um `DossierPausaModal`) e `src/dossier-store.js`.
- Regras: `src/evolucao-conferir-calc.js` e a cópia SQL `evolucao_conferir_achados` (migration nova, `create or replace`), com o teste de paridade.
- Coluna nova em `dossier_obra` (pausa por OBRA, não por equipamento — as regras já agrupam por obra).

### CLARIFY — decisões que dependem do Gelson (recomendação em negrito)
1. Quem pausa? **Felipe e Gelson** (alçada nova `mapa-obras.pausar`, Administrador sempre passa) / só Felipe.
2. Prazo obrigatório? **Sim, máximo de 60 dias, renovável com novo motivo** (senão a pausa vira esconderijo).
3. O que a pausa cala? **Só previsão vencida/desatualizada, "parado" e "sem Diário"**. Erros de dado (data no futuro, ordem inválida, sem série) continuam cobrando — pausa não justifica dado errado.
4. Aviso quando a pausa vence? **Sim, o resumo do dia do vencimento cita "pausa de X venceu"** (volta a cobrar no mesmo dia).
5. Pausa no Diário do montador? **Não nesta rodada.**

### PLAN / TASKS (só depois das respostas)
1. Testes primeiro (JS): obra pausada some das regras caladas; pausa vencida volta; erros de dado continuam.
2. Migration (CONFIRMO): colunas `pausada_ate date`, `pausa_motivo text`, `pausa_por text`, `pausa_em timestamptz` + histórico imutável `dossier_obra_pausas`; função SQL atualizada.
3. Modal "Pausar obra" no Dossiê + selo "Pausada até dd/mm" na Evolução/Mapa.
4. Paridade JS×SQL, CLAUDE.md, aviso de tutorial desatualizado.

### ANALYZE
- Mexe em tela de dossiê (não é área blindada) e na função da cobrança (já em produção): migration exige CONFIRMO.
- Risco: pausa esconder atraso real → mitigado por prazo máximo, motivo obrigatório e histórico.

### IMPLEMENT — pausa (25/10/2026, local, não commitado)
Decisões 1–5 aceitas como recomendadas. Feito: testes (9 novos) → regra JS → migration `20261025100000` **aplicada com CONFIRMO** → alçada `mapa-obras.pausar` no catálogo → `DossierPausaModal` + botão no Dossiê → selo "Pausada até" na Evolução. Verificado: `npm test` 812/812; no navegador local o modal abre e bloqueia sem motivo; no banco real (transação desfeita) pausar zera os achados de previsão da DOS-M035 e prazo > 60 dias é recusado. Pendente: conceder a alçada ao Felipe/Gelson; commit/PR sob pedido; regenerar o tutorial pela sessão de tutoriais.
