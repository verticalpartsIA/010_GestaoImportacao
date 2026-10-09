# Rota de Gatilhos & Prazo — Formulário até Embarque

> Documento de referência da cadeia automática implementada em [`src/gatilhos-engine.js`](src/gatilhos-engine.js).
> Cada nó "nasce" sozinho quando o evento anterior acontece (via `EventosFluxo.registrar`,
> ver [`src/eventos-fluxo-store.js`](src/eventos-fluxo-store.js)) e "fecha" quando o seu
> próprio evento acontece — dentro do sistema (formulário salvo, proposta enviada) ou fora
> dele (fornecedor respondeu, cliente assinou). Tudo correlacionado pelo **Nº da Cotação**.

## Tipos de relacionamento entre tarefas

Mesma lógica de dependência de tarefas do ProjectLibre/MS Project, aplicada aqui:

| Sigla | Nome | O que significa | Onde aparece nesta cadeia |
|---|---|---|---|
| **TI (FS)** | Término-Início | A sucessora só começa quando a predecessora termina. Padrão do sistema. | Praticamente toda a cadeia — cada evento fecha o nó anterior e abre o seguinte. |
| **II (SS)** | Início-Início | As tarefas começam juntas. | Contrato enviado e Projeto de Engenharia enviado nascem no mesmo instante (proposta aprovada), correndo em paralelo. |
| **TT (FF)** | Término-Término | Duas tarefas precisam terminar juntas. | Não usado nesta cadeia hoje — reservado para o dia em que testes de fábrica + laudo técnico entrarem no motor. |
| **IT (SF)** | Início-Término | O término da predecessora é condicionado ao início da sucessora. | Não usado nesta cadeia — típico de escalas de turno contínuo (fora do escopo comercial/importação). |

## A cadeia (v2 — com prazos reais)

Todo prazo é contado a partir do **nascimento** do nó (`nascido_em`), não da data de criação da cotação.

| # | Nó | Nasce quando | Fecha quando | Prazo (SLA) | Relação c/ anterior |
|---|---|---|---|---|---|
| 1 | Formulário preenchido | Formulário salvo | Cotação enviada ao Fornecedor | — | raiz |
| 2 | Aguardando resposta do Fornecedor | Cotação enviada | Fornecedor respondeu | **48 horas** | TI |
| 3 | Financeiro precificando | Fornecedor respondeu | Proposta elaborada (herança automática) | **2 horas** (era 5h até 29/09/2026) | TI |
| 4 | Preparando envio da Proposta | Proposta elaborada | Proposta enviada ao cliente | sem prazo — **envio é manual** (usuário clica "Enviar Proposta"; os dados já vieram por herança automática da Precificação) | TI |
| 5 | Aguardando resposta do Cliente | Proposta enviada | Cliente responde (aprova/recusa) | **15 dias** | TI |
| 6a | Contrato enviado ao Cliente | Cliente aprovou | Contrato de Venda enviado | **24 horas** | TI (de 5, só se aprovada) |
| 6b | Projeto de Engenharia enviado ao Cliente | Cliente aprovou | Projeto finalizado | **24 horas** | TI (de 5) + **II** com 6a — nascem juntos |
| 7 | Aguardando assinatura do Contrato | Contrato enviado | Contrato assinado | **5 dias** | TI |
| 8 | Aguardando pagamento do Boleto | Contrato assinado (boleto é gerado após a assinatura) | Financeiro confirma que o boleto foi pago (manual) | **3 dias** | TI |
| 9 | Aguardando Aval de Pagamento | Boleto pago | Financeiro dá o Aval de Pagamento — **clique manual** (é o "Aval Financeiro" do processo real: acontece depois do sinal pago) | **4 horas** | TI |
| 9b | Aguardando Aval Jurídico | **Proposta aprovada pelo cliente** (abre junto com o Aval Financeiro — desde 29/09/2026) | Jurídico dá o Aval Jurídico — **clique manual** (tela "Aval Jurídico"); corre em paralelo a contrato/boleto/Aval de Pagamento | — | TI (de 5) |
| 10 | Compra ao Fornecedor liberada | **Aval de Pagamento (Financeiro) E Aval Jurídico** — os dois avais manuais; o último a chegar dispara (+ CEO só se a margem < 15%) | Time de Importação decide comprar (`decidirComprar`, já existente) | — (é o gate, não uma espera) | TI |
| 11 | Negociação e Compra do Produto | Compra liberada | Compra confirmada com o fornecedor (`aprovar`, já existente — evento novo) | **7 dias** | TI |
| 12 | Embarque até chegada no Brasil | Compra confirmada | *(sem evento automático ainda — fronteira do que existe hoje no código; logística/embarques não está wired em `eventos_fluxo`)* | **90 dias** | TI |

Paramos deliberadamente no nó 12 — "pra não ficar grande". Quando o módulo de Logística
(`embarques`) ganhar um evento de "chegou no Brasil"/"desembaraço concluído", o nó 12 fecha
sozinho e a cadeia pode continuar (Desembaraço → Entrega na Obra).

### Lembretes automáticos (cobrança)

Sem cron/job agendado neste projeto — a verificação roda **ao abrir a tela "Gatilhos & Prazo"**
(`GatilhosEngine.verificarPrazos`, chamado no `reloadGatilhos` de `src/financeiro.jsx`). Ou
seja: o lembrete só "nasce" de fato quando alguém abre a tela depois do prazo ter passado —
não é instantâneo ao bater a hora exata.

| Nó pai | Lembrete nasce em | Ação esperada |
|---|---|---|
| Aguardando resposta do Cliente (nó 5) | **7 dias** (metade do prazo de 15 dias) | Comercial precisa "provocar" o cliente |
| Aguardando resposta do Cliente (nó 5) | **15 dias** (prazo estourado) | Status vira "Proposta requer revisão" — não fecha a cadeia, só sinaliza |
| Aguardando assinatura do Contrato (nó 7) | **3 dias** (do prazo de 5 dias) | Comercial/Jurídico cobra o cliente pela assinatura |

## Regras de negócio importantes

- **Nó 4 (envio da proposta) é sempre manual.** A Precificação herda os dados automaticamente
  para a Proposta (`proposta-heranca.js`), mas ninguém envia nada sem um clique humano em
  "Enviar Proposta" — o sistema não dispara e-mail/WhatsApp sozinho.
- **Nó 6a e 6b nascem juntos (II/SS)**, mas cada um tem seu próprio prazo de 24h e fecha
  independente — o Contrato pode ficar pronto antes do Projeto ou vice-versa.
- **A cadeia de pagamento agora é sequencial**, não paralela: Assinatura → Boleto gerado →
  Cliente paga → Financeiro confirma pagamento → Financeiro dá Aval de Pagamento → só então a
  Compra libera. Isso substitui o desenho anterior (v1), em que "Aguardando Sinal" e
  "Aguardando Assinatura" corriam em paralelo — a descrição real do processo veio depois e é
  sequencial.
- **Os dois avais são MANUAIS (processo real, confirmado pelo usuário em 29/09/2026).** O
  Financeiro dá o **Aval Financeiro** depois que o cliente paga o sinal (no código: "Aval de
  Pagamento", `confirmarAvalPagamento`, dado em "Gatilhos & Prazo") e o Jurídico dá o **Aval
  Jurídico** (`AvalJuridicoStore`), cada um clicando "aprovar" — nada é automático. Os dois juntos
  disparam a compra da importação.
- **Os dois avais ABREM juntos, quando o cliente aprova a Proposta** (29/09/2026, 2ª rodada). O
  trigger `fn_avais_abrir_na_proposta` (banco, em `propostas`) cria o registro em
  `avais_financeiros` e em `avais_juridicos` e grava a notificação "Avais Financeiro e Jurídico
  iniciados" em `alertas` (tela Notificações). Roda no banco porque a assinatura acontece na
  página pública `/assinar`. O Aval Jurídico deixou de depender do contrato assinado — o
  contrato, quando existir, só é vinculado ao mesmo registro (`contrato_venda_id`).
- **Quando os dois avais ficam OK**, o trigger `fn_avais_notificar_ok` grava a 2ª notificação
  ("Avais Financeiro e Jurídico OK") — uma vez só. Se a margem da precificação estiver abaixo de
  15% (ou desconhecida) e o CEO ainda não aprovou, o texto avisa que falta o CEO.
- **CEO só em discrepância**: a aprovação do CEO só é exigida (e só aparece na tela Aval
  Financeiro / no nó CEO_APROVOU / na decisão `compra_equipamento_ceo`) quando a margem efetiva
  da precificação fica **abaixo de 15%**, ou quando não há precificação — mesma regra do envio da
  Proposta (`DecisoesStore.precisaAprovacaoCeo`, `LIMITE_MARGEM_SEM_CEO`).
- **A consulta de score/aval de venda do Financeiro NÃO bloqueia o contrato** (29/09/2026) —
  `AvalFinanceiroStore.podeEnviarContrato` devolve sempre `ok`. A consulta de score e o "aval de
  venda" continuam na tela Aval Financeiro como registro **opcional** (nós FIN_SCORE/FIN_AVAL_VENDA
  informativos).
- O gate real de código (`AvalFinanceiroStore.podeIniciarCompra`) confere, nesta ordem: **Aval de
  Pagamento (Financeiro)**, **Aval Jurídico** e — só se a margem < 15% — a aprovação do CEO. A
  primeira que faltar é a mostrada. **Deixaram de travar a compra** (29/09/2026): aprovação do
  responsável pelo sistema (o botão "Minha aprovação" saiu da tela; nó OWNER_APROVOU não nasce
  mais), sinal pago como checagem própria (o Aval de Pagamento já vem depois dele), contrato
  assinado e revisão técnica de Engenharia. O nó COMPRA_LIBERADA só nasce quando Aval de Pagamento
  **e** Aval Jurídico já aconteceram (`requerEventos`). A cadeia de Gatilhos é a visualização; o
  gate no código é o que efetivamente bloqueia.

## Arquivos envolvidos

- [`src/gatilhos-engine.js`](src/gatilhos-engine.js) — grafo declarativo dos nós, SLAs em horas,
  lembretes, `onEvento()` (nasce/fecha reagindo a eventos) e `verificarPrazos()` (lembretes/
  revisão, chamado ao carregar a tela).
- [`src/eventos-fluxo-store.js`](src/eventos-fluxo-store.js) — catálogo de eventos (`EVENTOS`) e
  ponto único de disparo do motor.
- [`src/aval-financeiro-store.js`](src/aval-financeiro-store.js) — `confirmarSinal()` (boleto
  pago), `confirmarAvalPagamento()` (Aval Financeiro manual), `podeIniciarCompra()` (gate real,
  inclui o Aval Jurídico), `podeEnviarContrato()` (não bloqueia mais).
- [`src/aval-juridico-store.js`](src/aval-juridico-store.js) — Aval Jurídico manual (aprovar/reprovar),
  aberto na Proposta aprovada; junto com o Aval de Pagamento libera a compra, e é uma das 3
  condições do envio do Desenho de Instalação.
- [`supabase/migrations/20260929200000_avais_abrem_na_proposta.sql`](supabase/migrations/20260929200000_avais_abrem_na_proposta.sql)
  — triggers que abrem os dois avais na Proposta aprovada e gravam as 2 notificações.
- [`src/cotacao-elevador-fornecedor-store.js`](src/cotacao-elevador-fornecedor-store.js) —
  `decidirComprar()` (compra liberada) e `aprovar()` (compra confirmada — evento novo).
- [`src/financeiro.jsx`](src/financeiro.jsx) — tela "Gatilhos & Prazo", cadeia por Nº da
  Cotação renderizada como barra de Gantt (azul → vermelho conforme o prazo se esgota).
