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
| 3 | Financeiro precificando | Fornecedor respondeu | Proposta elaborada (herança automática) | **5 horas** | TI |
| 4 | Preparando envio da Proposta | Proposta elaborada | Proposta enviada ao cliente | sem prazo — **envio é manual** (usuário clica "Enviar Proposta"; os dados já vieram por herança automática da Precificação) | TI |
| 5 | Aguardando resposta do Cliente | Proposta enviada | Cliente responde (aprova/recusa) | **15 dias** | TI |
| 6a | Contrato enviado ao Cliente | Cliente aprovou | Contrato de Venda enviado | **24 horas** | TI (de 5, só se aprovada) |
| 6b | Projeto de Engenharia enviado ao Cliente | Cliente aprovou | Projeto finalizado | **24 horas** | TI (de 5) + **II** com 6a — nascem juntos |
| 7 | Aguardando assinatura do Contrato | Contrato enviado | Contrato assinado | **5 dias** | TI |
| 8 | Aguardando pagamento do Boleto | Contrato assinado (boleto é gerado após a assinatura) | Financeiro confirma que o boleto foi pago (manual) | **3 dias** | TI |
| 9 | Aguardando Aval de Pagamento | Boleto pago | Financeiro dá o Aval de Pagamento — **clique manual** (é o "Aval Financeiro" do processo real: acontece depois do sinal pago) | **4 horas** | TI |
| 9b | Aguardando Aval Jurídico do contrato | Contrato assinado | Jurídico dá o Aval Jurídico — **clique manual** (tela "Aval Jurídico"); corre em paralelo ao boleto/Aval de Pagamento | — | TI (de 7) |
| 10 | Compra ao Fornecedor liberada | **Aval de Pagamento (Financeiro) E Aval Jurídico** — os dois avais manuais; o último a chegar dispara | Time de Importação decide comprar (`decidirComprar`, já existente) | — (é o gate, não uma espera) | TI |
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
- **Os dois avais são MANUAIS (processo real, confirmado pelo usuário em 29/09/2026).** Depois
  que o cliente paga o sinal, o Financeiro dá o **Aval Financeiro** (no código: "Aval de
  Pagamento", `confirmarAvalPagamento`) e o Jurídico dá o **Aval Jurídico** (`AvalJuridicoStore`),
  cada um clicando "aprovar" — nada é automático. Os dois juntos disparam a compra da importação.
- **A consulta de score/aval de venda do Financeiro NÃO bloqueia mais o contrato** (29/09/2026).
  Antes, `AvalFinanceiroStore.podeEnviarContrato` exigia esse aval antes de gerar/enviar o Contrato
  de Venda; agora devolve sempre `ok` — o contrato é criado e enviado assim que a Proposta é
  assinada. A consulta de score e o "aval de venda" continuam disponíveis na tela Aval Financeiro
  como registro **opcional** (os nós FIN_SCORE/FIN_AVAL_VENDA seguem na cadeia, só informativos);
  "Confirmar sinal" e as aprovações do CEO/responsável ficam disponíveis mesmo sem esse aval
  (só somem se a venda foi marcada como reprovada).
- O gate real de código (`AvalFinanceiroStore.podeIniciarCompra`) confere: aprovação do CEO,
  aprovação do responsável, sinal pago, **Aval de Pagamento (Financeiro)**, contrato assinado
  pelo cliente, **Aval Jurídico** e revisão técnica do projeto (Engenharia) — a primeira que faltar
  é a mostrada. O nó COMPRA_LIBERADA da cadeia só nasce quando Aval de Pagamento **e** Aval
  Jurídico já aconteceram (`requerEventos` em `gatilhos-engine.js`). A cadeia de Gatilhos é a
  visualização; o gate no código é o que efetivamente bloqueia.

## Arquivos envolvidos

- [`src/gatilhos-engine.js`](src/gatilhos-engine.js) — grafo declarativo dos nós, SLAs em horas,
  lembretes, `onEvento()` (nasce/fecha reagindo a eventos) e `verificarPrazos()` (lembretes/
  revisão, chamado ao carregar a tela).
- [`src/eventos-fluxo-store.js`](src/eventos-fluxo-store.js) — catálogo de eventos (`EVENTOS`) e
  ponto único de disparo do motor.
- [`src/aval-financeiro-store.js`](src/aval-financeiro-store.js) — `confirmarSinal()` (boleto
  pago), `confirmarAvalPagamento()` (Aval Financeiro manual), `podeIniciarCompra()` (gate real,
  inclui o Aval Jurídico), `podeEnviarContrato()` (não bloqueia mais).
- [`src/aval-juridico-store.js`](src/aval-juridico-store.js) — Aval Jurídico manual (aprovar/reprovar)
  do contrato assinado; libera o Desenho de Instalação e, junto com o Aval de Pagamento, a compra.
- [`src/cotacao-elevador-fornecedor-store.js`](src/cotacao-elevador-fornecedor-store.js) —
  `decidirComprar()` (compra liberada) e `aprovar()` (compra confirmada — evento novo).
- [`src/financeiro.jsx`](src/financeiro.jsx) — tela "Gatilhos & Prazo", cadeia por Nº da
  Cotação renderizada como barra de Gantt (azul → vermelho conforme o prazo se esgota).
