# Revisões comerciais — Etapa 2: vigência nos consumidores, avais, decisões, gates e alinhamento por trilha (somente papel)

Data: 22/10/2026. **Nada aplicado, nenhum código.** Complementa `00-` (matriz) e `01-` (banco/RPCs).

## 1. Fatos novos levantados nesta etapa
- `avais_financeiros` e `avais_juridicos` têm índice único **por `proposta_id`** (`... WHERE proposta_id IS NOT NULL`). Revisão aprovada não conflita — **cria avais novos e duplica por cotação**. `avais_juridicos` também é único por `contrato_venda_id`.
- `decisoes_gerenciais` (62 linhas): `envio_proposta_gestor` (6) e `envio_proposta_ceo` (5) são **por cotação**, sem `referencia_*`. `podeEnviarProposta(numeroCotacao)` acha a decisão aprovada da cotação e libera. Resultado: uma revisão com margem pior **herdaria a aprovação da original** sem passar pelo Gestor/CEO. `compra_equipamento_ceo` (25) também é por cotação. `desconto_proposta` já usa `referencia_*` (por proposta).
- Eventos (`PROPOSTA_ENVIADA`, `PROPOSTA_REENVIADA`, `CLIENTE_RESPONDEU_PROPOSTA`) e o `fluxo_pendentes` carregam só `numeroCotacao`. O motor já tem o par `VERTICALPARTS_ACEITOU_REVISAO → PROPOSTA_REENVIADA`, mas só para o pedido feito antes da aprovação.
- `public_proposta_revisao` recusa tudo que não é `enviada`/`visualizada`.
- `PropostaStore` não tem consulta por cotação; os consumidores fazem a própria consulta (matriz da Etapa 0) — a troca é pontual, sem camada central a reescrever.

## 2. Uma regra de leitura para todos os consumidores
Duas perguntas diferentes hoje misturadas em "a proposta da cotação":
| Pergunta | Fonte nova | Quem usa |
|---|---|---|
| Qual revisão **vale** para o processo (avais, contrato, dossiê, comissão, equipamentos, Dashboard financeiro)? | view `propostas_vigentes` (1 linha por família, `vigencia='vigente'`) | #5, 8, 10–12, 14–17 da matriz |
| Qual revisão está **em negociação/ao cliente** agora (lista de Propostas, envio, assinatura)? | a última revisão enviada da família + a lista expandida | #7, 9, 13, 18, 20 |
Regras de borda: `pendente_aditivo` nunca entra em `propostas_vigentes`; contagens de Dashboard passam a contar **famílias**, não linhas; o seletor de Contrato Venda/Instalador mostra a revisão com rótulo (`VPPR-0990-A`) e prefere a vigente.

## 3. Avais por revisão (herdar ou reabrir)
Hoje: `fn_avais_abrir_na_proposta` cria Financeiro + Jurídico + alerta quando a proposta vira `aprovada`.
Novo comportamento quando a revisão R aprovada tem uma aprovada anterior P na família:
1. Calcula o **diff categorizado** R × P (§6).
2. **Sem mudança material** (só texto comercial/observações): copia os dois avais de P para R (`herdado_de_proposta_id`), sem alerta. O sinal pago continua valendo (é por cotação).
3. **Valor, forma de pagamento, impostos ou precificação mudaram**: reabre o **Aval Financeiro** da R (Aval de Pagamento reconfirmado; consulta de score é opcional como hoje).
4. **Escopo técnico ou cláusulas mudaram**: reabre o **Aval Jurídico** da R. Mudança técnica também sinaliza o **Aval Engenharia** (Projeto de Instalação já assinado vale para o escopo antigo — decisão aberta, §10).
5. Colunas novas em `avais_financeiros`/`avais_juridicos`: `herdado_de_proposta_id`, `motivo_reabertura`.
6. O gate de compra (`podeIniciarCompra`) e as filas passam a procurar o aval pela **revisão vigente**, não pela cotação.
7. Se a **compra ao fornecedor já foi iniciada** (`COMPRA_FORNECEDOR_INICIADA`), aprovar uma revisão com mudança de custo/escopo exige **ciência da Importação** (alerta + marca na revisão) antes de a vigência trocar. Decisão do responsável: item 5 da Etapa 0 mantido.
8. Com **Contrato assinado**: a revisão vira `pendente_aditivo` e dispara aviso ao Jurídico. O aditivo reaproveita o que já existe: novo Contrato de Venda derivado, numerado `VPCV-0955-2` pelo `proximoNumeroLivre` (já implementado). Financeiro participa só se o valor mudou.

## 4. Decisões da Central (Gestor/CEO) por revisão
- Novas decisões de envio passam a gravar `referencia_tabela='propostas'`, `referencia_id=<id da revisão>` (mesmo padrão de `desconto_proposta`).
- `podeEnviarProposta(numeroCotacao, propostaId)`: procura pela revisão. Linhas antigas sem `referencia_id` valem **só para a original (índice 0)**.
- Regra: **Gestor Comercial sempre aprova o envio de uma revisão** (documento novo); **CEO só se a margem efetiva da revisão ficar abaixo de 15% ou desconhecida** (mesma `LIMITE_MARGEM_SEM_CEO` e `margemEfetivaDaCotacao`, agora lida da precificação da própria revisão).
- `compra_equipamento_ceo` continua por cotação, mas é **reavaliada** quando a revisão aprovada muda a margem para abaixo de 15% (cria nova pendência sem apagar a anterior).
- "Ver documento" da Central (área blindada) passa a abrir a revisão pelo `referencia_id`; a regra de navegação (`setSubsel` + `setRoute`) não muda. **Mexo nessa área só com sua confirmação.**

## 5. Pedido de revisão, SLA e avisos
- Solicitação nova (qualquer trilha, inclusive depois de aprovada) gera: evento `PROPOSTA_REVISAO_SOLICITADA` com `detalhe.revisao`, `detalhe.trilha`; alerta **individual** ao vendedor e ao Gestor Comercial, e à liderança da trilha (financeira → Financeiro, técnica → Engenharia, jurídica → Jurídico). Via trigger em `proposta_solicitacoes_revisao` que **só insere em `alertas`** (id determinístico, falha engolida — mesmo padrão do alerta do Inbox).
- Depois de aprovada: evento próprio `CLIENTE_PEDIU_REVISAO_POS_APROVACAO` que **não reabre etapas já encerradas** do motor; cria só o nó "Analisar pedido de revisão".
- **SLA interno para aceitar/recusar/pedir informação: 8 horas úteis** — escolha minha, editável (`SLA_HORAS`), o responsável não definiu.
- `PROPOSTA_REENVIADA` fecha o nó quando a revisão que atende a solicitação é enviada.

## 6. Diff categorizado (módulo puro e testável `proposta-revisoes-calc.js`)
Mapa inicial de caminhos de `data_json` → categoria → trilha (a conferir contra `proposta-form.jsx`/`proposta-opcoes.js` na implementação):
| Categoria | Exemplos de campos | Trilha |
|---|---|---|
| Preço | `valores.itens`, `valorUnit`, `opcao90`, descontos | Financeira |
| Impostos | `ajustes.*` (reajuste, câmbio, taxas) | Financeira |
| Pagamento | `valores.formaTipo/parcelas/qtdParcelas`, forma | Financeira |
| Prazo | `prazo.*`, validade, garantia | Comercial (Financeira se afeta preço) |
| Técnico | especificações, `acabamentosCats`, `perfis`, equipamentos/códigos | Técnica |
| Serviços/texto | `conteudoCats`, infraestrutura, responsabilidades, abertura | Comercial (Jurídica se cláusula) |
| Observações | texto livre | Comercial |
Saída: lista por campo (antes → depois, unidade/moeda preservadas) e o conjunto de **trilhas afetadas**, que define as validações exigidas (`proposta_revisao_validacoes`) e a herança dos avais (§3). Compara também `snapshot_origens` (precificação/cotação de fornecedor/câmbio).

## 7. Gates de envio de uma revisão (`enviarRevisao`)
Bloqueiam: (1) revisão **idêntica** à base (use "Reenviar"); (2) trilhas exigidas sem validação nem dispensa justificada; (3) mudança de preço/impostos/pagamento sem precificação própria ou dispensa financeira justificada; (4) decisão de envio do Gestor (e CEO, se aplicável) pendente; (5) revisão não vigente/histórica sem reativação.
Só **avisam** (não bloqueiam): fonte de custo desatualizada (ex.: caso 990 — RFQ `-B` respondida e não usada), validade ou câmbio vencidos, compra iniciada, Projeto de Instalação assinado para escopo anterior.
Precificação por revisão: `VPPC-0990-A` com `numero_documento` UNIQUE e própria `cotacao_fornecedor_id`; o `precificacao-elevador-store` hoje não numera revisão — **subitem 2.5**, antes de ligar o gate (3).

## 8. Alinhamento do cliente por trilha (item que você pediu)
Painel informativo na revisão e no Histórico: **Comercial · Financeira · Técnica · Jurídica**, cada uma `pendente`, `de_acordo`, `pediu_revisao` ou `sem_resposta`. **Não substitui a assinatura**; a aprovação formal continua uma só.
- Tabela `proposta_alinhamentos` (`proposta_id`, `trilha`, `estado`, `por_nome`, `por_papel`, `por_contato`, `origem` (link_publico/email/whatsapp/reuniao/manual), `solicitacao_id`, `prova`, `em`, `herdado_de_proposta_id`). Nasce fechada, escrita só por RPC.
- Alimentação: (a) pedido de revisão numa trilha marca `pediu_revisao` automaticamente; (b) página pública ganha o bloco "Estou de acordo com…" por trilha (RPC `public_proposta_alinhar`; **área blindada de assinatura — peço sua confirmação**); (c) o vendedor registra à mão um "de acordo" recebido por e-mail/WhatsApp/reunião, com prova.
- Nova revisão **herda** o `de_acordo` das trilhas **não afetadas pelo diff** (`herdado_de_proposta_id`) e zera as afetadas.
- Aparece em Propostas (coluna resumida), no editor e no Controle de Cotações.

## 9. Links por revisão e reativação (decisão 2)
Cada **link** tem a sua versão: tabela `proposta_tokens` (`token`, `proposta_id`, `emitido_em`, `emitido_por`, `motivo` = original/reenvio/reativacao, `assinavel`). A reativação pelo Gestor **emite token novo**; o antigo continua abrindo o conteúdo que o cliente viu, mas **só leitura** (sem assinar), com o aviso "existe versão mais recente". `public_proposta_obter` resolve token novo ou antigo; auditoria (visualização/assinatura) guarda **qual token** foi usado. Substitui o "mesmo link com validade renovada" do `01-` §5.3.

## 10. Imutabilidade (modo observar)
Trigger em `propostas` que **só registra** em `proposta_eventos` toda alteração de `data_json`/`versao_publicada`/`valor_total` feita depois de `sent_at`. Meta: mapear os escritores legítimos (`public_proposta_assinar` com troca 120/90, `publicar`, `salvar`, conversão legada) por 1–2 semanas antes de bloquear.

## 11. Ordem de execução da Etapa 2 (quando houver "pode aplicar")
2.1 `propostas_vigentes` + trocar os consumidores sem risco de comportamento (listas, Dashboard, Notificações) → 2.2 avais herdados/reabertos + gate de compra pela vigente → 2.3 decisões por revisão → 2.4 eventos/alertas/SLA de solicitação → 2.5 precificação por revisão → 2.6 diff, validações, gates e alinhamento por trilha → 2.7 modo observar de imutabilidade.
Cada passo atrás da flag, testado em transação desfeita; **autorização explícita antes de editar** `assinar-app.jsx`, RPCs `public_proposta_*`, Central de Decisões e fluxo de e-mail.

## 12. Decisões que ainda dependem do responsável
1. Mudança **técnica** numa revisão aprovada invalida o Projeto de Instalação já assinado (reassinatura) ou só avisa a Engenharia?
2. Gestor Comercial aprova **toda** revisão antes de enviar (proposto) ou só as que mudam preço/escopo?
3. SLA de 8 h úteis para analisar o pedido do cliente serve?
