# Fio ao pavio — da compra ao fornecedor à entrega dos documentos

> WBS operacional da Gestão Importação, minerado do código real (não inventado). Onde o sistema não cobria algo, ficava marcado como vazio — os 3 vazios encontrados nesta rodada já foram implementados e testados (ver seção final).
>
> Versão navegável (com cores, legendas e melhor leitura): [artifact publicado](https://claude.ai/code/artifact/a4bcccd0-242a-4637-bf02-013a5cab6ead).

**Resumo:** 45 tarefas mapeadas · 7 papéis/recursos diferentes · ~90 dias de navio em trânsito (janela pra adiantar obra) · 3 vazios da 1ª rodada, todos preenchidos · da auditoria seguinte (15/08): fragmentação da vistoria corrigida, gate de compra (A1) implementado — ver seção no fim do documento.

**A descoberta que mais importa pro custo:** a Vistoria da obra e a Contratação do Instalador **não dependem de nada que aconteça no navio** — nenhuma das duas tem pré-requisito ligado ao Embarque no código. Isso significa que elas podem (e devem) rodar **durante os ~90 dias de trânsito**, não depois. Se a equipe só começa a pensar em instalador quando o equipamento chega no porto, é atraso evitável — o próprio desenho do sistema já permite rodar em paralelo.

**Legenda:** `gate` = bloqueia até as condições baterem · `manual` = sem cobrança automática de prazo · `campo novo` = vazio encontrado no primeiro rascunho deste WBS, já preenchido no código (PR [#257](https://github.com/verticalpartsIA/010_GestaoImportacao/pull/257)).

---

## A — Decisão de compra e emissão da P.I.

*Do aval de pagamento confirmado até o fornecedor começar a produzir.*
Fonte: `decisoes-store.js` · `pi.jsx` · `pi-store.js`

| # | Tarefa | Recurso | Duração / SLA | Onde | O que pesa no custo |
|---|---|---|---|---|---|
| A1 | Compra do equipamento — aprovação do CEO **✅ implementado (15/08)** | CEO (Diego) | sem SLA · `manual` | Central de Decisões · dispara quando o cliente aprova a proposta | Equipamento caro (só o frete marítimo já passa de R$ 7 mil) — aprovação corre em paralelo, cedo, sem atrasar o resto |
| A1b | Gate final antes do "start" da compra — aprovação do CEO **E** contrato assinado **E** sinal pago **E** aval financeiro confirmado | sistema | — | P.I. › bloqueia "Salvar P.I." até liberar | Trava o 1º pagamento até tudo estar de fato pronto — câmbio do dia só é gasto quando a compra é irreversível |
| A2 | Negociação final com o fornecedor | Comercial/Importação | SLA 7 dias | Cotação a Fornecedor | Margem de negociação — preço final ainda não travado |
| A3 | P.I. criada — nº, fornecedor, incoterm, itens, NCM | Importação | — | P.I. | Valor total do equipamento fica travado em USD/moeda de origem |
| A4 | 1º pagamento ao fornecedor (remessa internacional) | Financeiro | — | P.I. › Pagamento | Cotação do dólar do dia registrada — é o câmbio real da compra, não estimado |

## B — Produção, frete e embarque

*Do início da produção até o navio sair do porto de origem.*
Fonte: `pi.jsx` · `rfq.jsx` · `embarques-importacao.jsx`

| # | Tarefa | Recurso | Duração / SLA | Onde | O que pesa no custo |
|---|---|---|---|---|---|
| B1 | Produção inicia no fornecedor | Fornecedor | variável · `manual` | P.I. › Produção | Prazo de produção define a janela real do projeto — maior bloco de tempo antes do embarque |
| B2 | Acompanhamento de produção — fotos/relatórios anexados | Importação | — | P.I. › Produção › Anexos | — |
| B3 | Cargo Ready — produção concluída | Fornecedor | — | P.I. › Produção | Dispara a contagem real pro booking do navio |
| B4 | 2º pagamento (saldo) ao fornecedor | Financeiro | — | P.I. › Pagamento | 2ª cotação de câmbio do dia — pode ser bem diferente da 1ª |
| B5 | RFQ de frete — cotar mais de 1 Agente de Carga (opcional) | Importação | — | RFQ | Comparativo já existe pronto — deixar de rodar aqui é deixar dinheiro na mesa |
| B6 | Agente de Carga definido — modalidade, transit time, free time | Importação | — | Embarque › Frete | Frete internacional — 2ª maior linha de custo depois do equipamento |
| B7 | Booking do navio + Embarque cadastrado (referência, portos, navio, AWB/BL, containers) | Importação | — | Embarque | — |
| B8 | ETD original registrado → navio sai do porto de origem (rolagem do armador fica no histórico) | Importação | — | Embarque › Rolagens | Rolagem = todo o cronograma abaixo desliza junto |
| B9 | P.I. vinculada ao Embarque | Importação | — | P.I. › Vincular embarque | A partir daqui o valor total do embarque é somado automaticamente das P.I. |

## C — Enquanto o equipamento está no mar (~90 dias, roda em paralelo)

*Nenhuma destas tarefas espera o embarque chegar — todas podem começar assim que o navio sai do porto de origem (algumas, até antes). É aqui que se ganha ou se perde tempo de projeto.*
Fonte: `vistorias-obras.jsx` · `instalacao-obra-store.js` · `rh-homologacao-store.js` · `decisoes-store.js`

> ✅ C1–C4 (15/08): as 3 vistorias fragmentadas foram consolidadas em `vistorias_obras`, hoje a única fonte de verdade — acessível tanto pelo menu "Vistorias de Obras" quanto embutida na aba Instalação do Dossiê da Obra, sempre mostrando os mesmos dados. Ver auditoria no fim do documento.

| # | Tarefa | Recurso | Duração / SLA | Onde | O que pesa no custo |
|---|---|---|---|---|---|
| C1 | Vistoria da obra — Fase 1 (3 fases inclusas no contrato; avulsas cobradas à parte) | Engenharia | — | Dossiê da Obra › Vistorias (ou menu "Vistorias de Obras") | Custo por vistoria registrado no ato — soma dá o gasto real de vistoria da obra |
| C2 | Vistoria da obra — Fase 2 | Engenharia | — | Dossiê da Obra › Vistorias | — |
| C3 | Vistoria da obra — Fase 3 | Engenharia | — | Dossiê da Obra › Vistorias | — |
| C4 | Vistoria avulsa (se a obra exigir mais que 3) | Engenharia | sob demanda | Dossiê da Obra › Vistorias avulsas | Custo lançado à parte, fora do orçamento inicial — impacta margem se não for repassado |
| C5 | Decisão: contratar mão de obra do instalador (aprovação exclusiva do CEO) | CEO | sem SLA · `manual` | Central de Decisões | Mão de obra terceirizada de instalação — cotação própria, fora da P.I. |
| C6 | Homologação do parceiro instalador (5 certificações: NR-10, NR-35, ASO, PCMSO, PGR) | RH | — | Homologação de Parceiros Instaladores | Parceiro sem homologação válida = obra parada por não-conformidade, custo de re-mobilização |
| C7 | Vínculo do instalador a ESTA obra (mesmo já homologado em geral, precisa de aprovação específica) | RH | sem SLA · `manual` | Central de Decisões | — |
| C8 | Verificar necessidade de andaime/munck na obra | Engenharia | — | Dossiê da Obra › Checklist | "Quando aplicável" — só entra na conta se marcado necessário |
| C9 | Providenciar andaime/munck, se necessário | Logística (IMS) | — | IMS · recurso Munck/Andaime | Cotação de fornecedores no IMS — peso da carga e altura de içamento definem o equipamento certo |
| C10 | ART providenciada (pode começar aqui — depende do projeto aprovado, não do equipamento físico) | Engenharia | — | ART | Taxa do CREA/conselho — valor fixo, independe de quando é feito |
| C11 | Escalar mão de obra própria mínima pra recepção do equipamento no cliente — **campo novo** | Engenharia / equipe própria | — | Dossiê da Obra › Instalação · `equipamento_recebido_por`, `equipamento_qtd_pessoas_recebimento` | 2 pessoas × dias de deslocamento/estadia até a obra — agora rastreável obra a obra |

## D — Chegada no Brasil e desembaraço

*Do navio atracando em Santos até o equipamento sair do porto.*
Fonte: `embarques-importacao.jsx` · `ims.jsx`

| # | Tarefa | Recurso | Duração / SLA | Onde | O que pesa no custo |
|---|---|---|---|---|---|
| D1 | Navio chega no porto de Santos — ETA confirmado | Importação | SLA 90 dias (desde a compra confirmada) · fecha `manual` | Embarque | — |
| D2 | DUIMP registrada — Declaração Única de Importação (não é o mesmo DUIMP do cadastro de produto/NCM — este é da carga que chegou) | Despachante | — | Embarque › Aduaneiro | — |
| D3 | Canal de parametrização sai — Verde / Amarelo / Vermelho / Cinza | Receita Federal | — | Embarque › Aduaneiro | Canal ≠ Verde = conferência extra, custo e tempo não previsíveis de antemão |
| D4 | Conferência documental/física, se canal ≠ Verde — **campo novo** | Despachante | variável | Embarque › Aduaneiro · `conferencia_status`, `conferencia_motivo`, `conferencia_data` | Maior fonte de atraso imprevisível do processo — agora com motivo registrado, não só o resultado final |
| D5 | Free time correndo — prazo até `ultima_data_free_time` | Importação | definido no frete (B6) | Embarque › Aduaneiro | Estourar o free time = demurrage por dia parado no porto |
| D6 | Empresa de desembaraço fatura | Financeiro | — | Embarque › Faturamento | Faturamento + numerário — 3ª linha de custo relevante |
| D7 | Recurso de transporte alocado — retirada do porto | Logística (IMS) | — | IMS · recurso Transporte | Tipo de carga e peso definem o veículo — escolta se necessário |
| D8 | Munck/Empilhadeira alocado, se necessário — descarga | Logística (IMS) | — | IMS · recurso Munck/Empilhadeira | — |
| D9 | NF-e emitida | Financeiro | — | Embarque › Entrega | — |
| D10 | Devolução do container | Importação | — | Embarque › Entrega | Atraso na devolução = multa por dia junto ao armador |

## E — Gate de liberação, entrega e instalação

*O AND lógico é literal no código: as três condições precisam estar verdadeiras ao mesmo tempo — não importa a ordem em que ficaram prontas.*
Fonte: `project-gates.js` · `instalacao-obra-store.js`

| # | Tarefa | Recurso | Duração / SLA | Onde | O que pesa no custo |
|---|---|---|---|---|---|
| E1 | Gate de instalação `gate` — Contrato assinado + Pagamento F1 liberado + PDF do Projeto recebido, os três sem exceção | sistema | — | `validarGatesImportacao()` | Se algum dos 3 atrasar, a instalação não libera mesmo com equipamento e obra prontos |
| E2 | Equipamento chega no endereço do cliente (CD próprio ou direto na obra, conforme D7) | Transportadora | — | Embarque › Entrega | — |
| E3 | Recepção do equipamento — mínimo 2 pessoas no local — **campo novo** (mesmo campo de C11) | Engenharia / equipe própria | — | Dossiê da Obra › Instalação · `equipamento_entregue` + `equipamento_recebido_por` | Descarga sem gente suficiente = risco de avaria — agora com responsável registrado se acontecer |
| E4 | Instalação em campo inicia (só com instalador vinculado — C6+C7 — e gate E1 aberto) | Instalador homologado | — | Instalação em Campo | Mão de obra já contratada em C5 — aqui só executa |
| E5 | Acompanhamento — Status de Obras | Engenharia | — | Status de Obras | — |

## F — Documentação e entrega final

*O checklist de handover é de 8 itens, e a assinatura do cliente é o último — não o primeiro.*
Fonte: `data-book-store.js` · `handover-manutencao.js`

| # | Tarefa | Recurso | Categoria | Onde | O que pesa no custo |
|---|---|---|---|---|---|
| F1 | ART formalmente registrada e entregue | Engenharia | legal | ART | — |
| F2 | Data Book — upload de documentos técnicos por obra | Engenharia | documentação | Data Book & Termo | — |
| F3 | Equipamento testado e funcionando | Instalador | técnico | Entrega Final | — |
| F4 | Documentação e manuais entregues | Engenharia | documentação | Entrega Final | — |
| F5 | Data Book assinado pelo cliente | Cliente | documentação | Entrega Final | — |
| F6 | Certificados e ART entregues ao cliente | Engenharia | legal | Entrega Final | — |
| F7 | Treinamento do cliente realizado | Instalador | operacional | Entrega Final | — |
| F8 | Contato de suporte 24/7 confirmado | Comercial | operacional | Entrega Final | — |
| F9 | Período de garantia explicado (padrão: 12 meses) | Comercial | comercial | Entrega Final | Garantia é um custo contingente — cada acionamento pesa na margem já fechada |
| F10 | Assinatura do cliente no Termo de Entrega | Cliente | legal | Entrega Final | Fecha o ciclo — sem isso, formalmente a entrega não aconteceu |
| F11 | Transição para Escamax (pós-venda/manutenção) | Engenharia | operacional | `escamax_transferido` | A partir daqui o custo de manutenção sai do escopo desta obra |

---

## Os 3 vazios reais que este WBS achou — já preenchidos no código

Detectados na primeira versão deste documento e implementados em seguida (PR [#257](https://github.com/verticalpartsIA/010_GestaoImportacao/pull/257), mergeado em `main`):

- **C11 / E3** — na verdade era um único vazio, não dois: o checkbox "equipamento entregue" no Dossiê da Obra agora pede `equipamento_recebido_por` (nome dos responsáveis) e `equipamento_qtd_pessoas_recebimento` antes de fechar — o mínimo de 2 pessoas fica documentado obra a obra, não é mais lembrete de memória.
- **D4** — a aba Aduaneiro do Embarque ganhou um bloco condicional (só aparece quando o canal não é Verde) com `conferencia_status`, `conferencia_motivo` e `conferencia_data` da conferência extra da Receita.

Testado ao vivo contra o Supabase real antes do merge — inclusive um bug real pego no meio do teste: os 3 campos de conferência estavam sendo descartados silenciosamente ao salvar, porque a função que monta a linha do banco (`_payload()` em `embarques-importacao-store.js`) tinha uma lista explícita de campos que não incluía os novos. Corrigido antes do commit.

---

## Auditoria seguinte (15/08)

Conferindo o WBS direto contra o código depois do primeiro merge, achei mais dois pontos onde o site não refletia o que parecia estar documentado/implementado.

### ✅ Vistoria da obra tinha 3 implementações que não se falavam — corrigido

"Vistorias de Obras" no menu gravava em `vistorias_obras` (a mais completa — agendamento, vistoriador, docs/imagens), mas era inalcançável na prática: o clique no menu nunca passava o `obraId` que o componente precisa, então a tela sempre mostrava "nenhuma vistoria encontrada", sem nenhum seletor de obra. "Instalação em Campo" no menu gravava em `projetos.vistoria` via `vistoria-tracker.js` (o modelo mais antigo, de 19/06). E a aba Instalação dentro do Dossiê da Obra — a que este WBS documentava em C1–C4 — gravava num terceiro lugar, `dossier_obra.vistoria` via `instalacao-obra-store.js`, criado nesta mesma sessão sem eu checar que já existiam dois.

Ao investigar pra consertar, achei ainda um **quarto problema**: mesmo com o `obraId` certo, a tabela `vistorias_obras` tinha uma política de segurança (RLS) de INSERT quebrada — comparava uma coluna da própria linha sendo inserida (`criado_por`, que o código nunca preenchia) contra `auth.uid()`, então nenhuma vistoria jamais teria sido salva ali, nem que o `obraId` estivesse certo desde o início.

**Consolidado**: `vistorias_obras` (chave = `dossier_obra.id`) agora é a única fonte de verdade. `vistorias-obras.jsx` ganhou um seletor de obras pra quando é aberta direto pelo menu, e um modo `embedded` pra aparecer dentro da aba Instalação do Dossiê sem duplicar cabeçalho. A política de RLS foi trocada pra bater com o padrão do resto do projeto (`true`/anon-permissivo, igual `dossier_obra`). O checklist "obra pronta" agora lê as 3 fases direto de `vistorias_obras`. `vistoria-tracker.js` e o mini-plano que vivia em `instalacao-obra-store.js` foram desligados da UI (arquivos continuam no repo, sem uso). Testado ao vivo: vistoria criada pela aba Instalação do Dossiê aparece idêntica ao abrir "Vistorias de Obras" pelo menu, e vice-versa; o checklist atualiza em tempo real.

### ✅ A1 não era um gate de verdade — corrigido

A Central de Decisões mostrava os rótulos "Compra ao fornecedor — CEO" e "— responsável" na tela (`decisoes.jsx`), mas nenhuma função em `decisoes-store.js` jamais criava uma decisão desses tipos — eram `label`s sem gatilho, mortos numa tabela de lookup. Na prática, qualquer pessoa com acesso à P.I. criava a compra e mandava o 1º pagamento sem nenhuma aprovação bloqueante.

**Regra definida pelo usuário (15/08)**: toda compra de equipamento (elevador/escada rolante — caro demais pra deixar sem controle, só o frete marítimo já passa de R$ 7 mil) precisa da aprovação do CEO. O gatilho é assim que o **cliente aprova a proposta** — bem antes da assinatura do contrato ou do pagamento do sinal, pra não atrasar o resto do fluxo. Mas o **início real da compra** (a P.I. em si, o 1º pagamento ao fornecedor) só é liberado depois que a cadeia automática de gatilhos também fechar: contrato assinado + sinal pago + aval de pagamento confirmado.

**Implementado**: `decisoes-store.js` ganhou o tipo `compra_equipamento_ceo` (função `podeComprarEquipamento`) e `verificarGateCompra`, que soma essa aprovação com o nó `COMPRA_LIBERADA` já existente em `gatilhos-engine.js`. O disparo acontece em `proposta-store.js`, no exato momento em que o cliente assina/aprova a proposta pelo link público. A P.I. ganhou um campo "Nº Cotação" — quando preenchido, `pi.jsx` mostra o status do gate ao vivo e bloqueia "Salvar P.I." até estar tudo liberado. Testado ao vivo: P.I. bloqueada com CEO pendente → aprovação simulada → ainda bloqueada (gatilhos automáticos pendentes) → gatilhos liberados → P.I. salva com sucesso. Dado de teste removido depois.

---

**Fontes:** `decisoes-store.js`, `pi-store.js`, `pi.jsx`, `proposta-store.js`, `gatilhos-engine.js`, `rfq-store.js`, `embarques-importacao-store.js`, `ims-store.js`, `vistorias-obras.jsx`, `instalacao-obra-store.js`, `dossier-obra.jsx`, `rh-homologacao-store.js`, `project-gates.js`, `data-book-store.js`, `handover-manutencao.js`.

Complementa o fluxograma de 4 fases (Cliente → Instalação) publicado anteriormente nesta conversa — este documento é o detalhamento tarefa a tarefa da Gestão Importação em diante.
