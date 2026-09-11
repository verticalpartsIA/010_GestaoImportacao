# Projeto: Granularidade de valor por equipamento (Precificação → Proposta → Contrato)

Status: **Fase 1 e Fase 2 no ar. Fase 3 em andamento, sub-parte (a) feita, (b)/(c)/(d) pendentes — implementando uma por vez.**

## Contexto / gatilho

Na cotação VPCT-0950 (2 elevadores diferentes, VPEL-EL0950-1 e VPEL-EL0950-2), a Proposta Comercial
mostra os dois equipamentos em linhas separadas, cada uma com seu valor. O dono do produto notou que
os dois valores eram idênticos e suspeitou que a Precificação estivesse "homogeneizando" N equipamentos
num valor único antes de mandar pra Proposta — e que isso só não apareceu como bug na 950 por acaso.
Pergunta motivadora: **isso escala pra 3, 4, N equipamentos, ou é um caso específico?**

## Diagnóstico (confirmado lendo o código, arquivo:linha)

| Etapa | Granularidade por equipamento? | Evidência |
|---|---|---|
| Formulário do Cliente | ✅ Sim, por design | `formulario-elevador-store.js` — cada unidade é uma linha própria (`unidades: []`), com `id` no banco. Código do ativo (`VPEL-EL0917-1`) gerado por `feCodigoUnidade()` (`formulario-elevador.jsx:213-217`) via `MasterIdEngine.masterId({numeroCotacao, indiceAtivo})`. |
| Cotação a Fornecedor (RFQ) | ✅ Sim | `cotacao-elevador-fornecedor-store.js:164-165` — RFQ montado por unidade (`unidades: unidades.map(u => ({unidade_id: u.id, ...}))`). Resposta do fornecedor grava `respostas.itens[]` com `unidade_id` e `preco_total` por item (linha ~465). Único `reduce` (linha 407) é agregado de exibição pra fila de embarques, não descarta os itens. |
| **Precificação (motor)** | ✅ Sim, mas convivendo com uma média que a esconde | `precificacao-elevador-engine.js:170-175` — rateia o preço total (`S65_precoVendaProposta`) por modelo/unidade, proporcional ao custo USD real de cada um: `valorUnitarioRs` por `modelos[]` item (cada um já carrega `unidadeId`, ver `precificacao-elevador-store.js:136`). **Isso já é o valor certo, por equipamento.** Só que a mesma função também expõe `U69_precoVendaPorEquipamento = total ÷ quantidade` (linha 140) — uma média simples, sem diferenciar modelo. |
| **Herança pra Proposta** | ❌ **Aqui a informação se perde** | `proposta-heranca.js:191-217` (`montarPrefill`). Ao montar `valores.itens[]` (uma linha por equipamento, sempre que `especificacoes.length > 1`), usa a **média** (`resultado.precoVendaPorEquipamento`) pra todos os itens — não o rateio granular (`precificacao.modelos[].valorUnitarioRs`), que já está disponível e correto. O próprio comentário no código (escrito numa sessão anterior, linhas 197-203) já documentava isso como pendência: *"precoVendaPorEquipamento é uma média [...] Frente 3, não feita ainda"*. |
| Contrato de Venda | ❌ Nunca teve | `contrato-venda-engine.js:268` — clausulado usa "valor total" único. `contrato-venda-store.js` só referencia `master_id` da cotação inteira (linhas 180, 280, 325), sem `itens[]`/`ativos[]`. |
| Diário de Obra / Instalação | ⚪ Não se aplica a valor | `instalacao-checklist-store.js`, `diario-obra-app.jsx` operam por `obra_id`/dossiê — nunca trabalharam com preço por equipamento, só identificação (que já é granular via `montarAtivos()` em `proposta-heranca.js:121-138`). |

**Conclusão central**: a informação certa (preço por equipamento, ponderado pelo custo real de cada um)
**já existe e já é calculada** dentro da Precificação. O bug não é "o motor homogeneíza" — é que a
Herança pra Proposta pega a peça errada (a média) em vez da peça certa (o rateio por modelo), que já
está a um passo de distância no mesmo objeto de resultado.

A boa notícia prática: a função que monta as especificações por equipamento
(`montarEspecificacoes`, `proposta-heranca.js:80-119`) **já faz o `.find()` do modelo certo por
`unidadeId`** (linha 91, `const mod = modelos.find((m) => m.unidadeId === uid)`) — só não está lendo
`mod.valorUnitarioRs` de lá. A correção é ligar um fio que já está encostado, não construir um novo.

Isso também responde a pergunta "escala pra 3, 4, N?": **sim, sem mudança nenhuma de estrutura** — o
`.map()` sobre `especificacoes` e o `.find()` por `unidadeId` já são genéricos pro tamanho do array.
O que precisa mudar é só QUAL valor cada item usa, não a lógica de quantos itens existem.

## Plano faseado

### Fase 1 — Precificação → Proposta (pequena, precisa, baixo risco)
Objetivo: cada item da proposta nasce com o valor real do seu equipamento, não a média.

1. `proposta-heranca.js` — `montarEspecificacoes()`: adicionar `valorUnitarioRs: mod.valorUnitarioRs ?? null`
   ao objeto retornado por especificação (ao lado de `modelo`, linha ~105).
2. `montarPrefill()` (linhas 204-217): ao montar `valores.itens[]`, usar
   `Math.round(e.valorUnitarioRs)` quando existir e for > 0; cair pra `unit` (a média atual) só como
   fallback defensivo — cotações antigas ou com `modelos[]` incompleto não devem quebrar.
3. Atualizar o comentário existente (linhas 197-203) que já documentava isso como "Frente 3, não feita
   ainda" — remove a pendência do código.
4. Teste: revalidar a cotação 950 (2 modelos diferentes — VP-301 e VP-200, custos USD diferentes) e
   confirmar que os dois valores passam a ser DIFERENTES entre si (hoje são iguais por coincidência de
   serem clonados da mesma média). Testar também um caso com 1 equipamento só (não deve regressar) e,
   se der pra simular, um caso com 3+ para confirmar que escala sem ajuste extra.
5. Nota de cautela: quando os N equipamentos são do MESMO modelo (custo idêntico), o valor rateado será
   igual entre eles de qualquer forma — isso é correto, não é o bug. O bug só é visível quando os
   equipamentos são modelos DIFERENTES com custos diferentes (como na 950).

**Escopo**: só `proposta-heranca.js`. Não toca em `precificacao-elevador-engine.js` (o cálculo já está
certo lá) nem no schema do banco (não precisa de migration).

### Fase 2 — Contrato de Venda ✅ FEITO
Cláusula 3.1.1 informativa por equipamento, herdando `elevador.valores.itens[]` da Proposta. Cláusula
3.1 (valor total) e cláusulas de multa/rescisão continuam inalteradas — só aparece quando há mais de 1
equipamento. Commit `344908b`.

### Fase 3 — Diário de Obra / pagamento ao instalador (revisado — TINHA razão de ser)

**Correção ao diagnóstico original**: eu tinha marcado esta fase como "provavelmente não precisa" por
achar que Diário de Obra era só operacional. O usuário apontou o motivo real: o Diário de Obra
**desbloqueia o pagamento ao montador**, e o custo de instalação que a Precificação prevê precisa bater
com o que de fato é pago — "se a Precificação diz que instalar é R$10k, aquilo tem que ser a mais pura
verdade até o fim". Investiguei de novo com esse critério e o problema é mais sério do que a Fase 1: os
dois números **nunca se conversam hoje**.

Diagnóstico (arquivo:linha):
- **Precificação** (`precificacao-elevador-engine.js:69,96`) já entrega o custo de instalação
  (`U32_despesasInstalacaoMontagem`) como total único da cotação inteira. A mão de obra JÁ é calculada
  por unidade (`pz.mo_lookup[i].valorRs`, tabela em `precificacao-elevador.jsx:509-568`), mas essa
  granularidade morre ali — só a soma entra no motor (`precificacao-elevador.jsx:691-692`). As demais
  categorias (ART, andaime, talha, empilhadeira, ajudantes) nunca tiveram dado de origem por unidade —
  são digitadas já agregadas pra cotação inteira.
- **Contrato Instalador** (`contrato-instalador.jsx:491`) não lê a Precificação em nenhum momento — o
  "Valor total do contrato" é digitado manualmente, pode cobrir vários dossiês/equipamentos ao mesmo
  tempo, e é um valor único pro contrato inteiro.
- **Diário de Obra** (`diario-obra-app.jsx:152-154`, gatilho A10 em `acompanhamento-obra-store.js:145-165`)
  dispara o desbloqueio por `dossier_id` (a obra inteira), não por equipamento — quando há 2+
  equipamentos na mesma obra, aparecem concatenados num único registro de progresso.
- **Reconciliação**: não existe nenhuma comparação hoje entre "quanto a Precificação previu" e "quanto
  foi pago" — confirmado por grep, `U32_despesasInstalacaoMontagem` não aparece fora do próprio módulo
  de Precificação.

Plano em 4 sub-partes, uma por vez (pedido explícito do usuário):

- **3a. Fonte da verdade — ✅ FEITO** (`proposta-heranca.js`, `montarAtivos()`): cada ativo (equipamento)
  agora carrega `custoInstalacaoMaoDeObraRs`, lido de `precificacao.mo_lookup[]` por `unidadeId` — a
  parcela de mão de obra (a dominante) passa a ser genuinamente por equipamento, em vez de descartada.
  As categorias sem dado de origem por unidade (ART, andaime, etc.) **não** são rateadas artificialmente
  — ratear sem base real seria inventar um número, o oposto de "pura verdade". Testado com a cotação 950:
  VPEL-EL0950-1 → R$ 38.100, VPEL-EL0950-2 → R$ 16.500 (valores diferentes, batendo com o porte de cada
  elevador).
- **3b. Contrato Instalador** (pendente): hoje o valor é 100% manual e por contrato inteiro. Precisa
  decidir: o campo "Valor total do contrato" vira uma lista com um valor por dossiê/equipamento vinculado
  (mudança de UI + schema), ou mantém 1 valor mas ganha um "valor sugerido" pré-preenchido a partir da
  soma dos `custoInstalacaoMaoDeObraRs` dos equipamentos vinculados (mudança bem menor, só ajuda a
  digitação, não obriga nada)? Essa escolha muda o tamanho do trabalho.
- **3c. Diário de Obra / gatilho A10** (pendente): hoje o gatilho é só por `dossier_id`. Rastrear
  progresso por equipamento individual (não só por obra) é uma mudança de schema em
  `acompanhamento_obra_itens`/`_lancamentos` — maior, mexe em fluxo já em uso.
  Só faz sentido depois de 3b decidir como o pagamento por equipamento vai ser modelado.
- **3d. Reconciliação** (pendente): uma tela/alerta que compare "previsto na Precificação" × "pago de
  fato" (via Omie, já lido por `omie-pagamentos-store.js`) e avise quando não bater. Só é possível depois
  de 3b/3c existirem — é o fechamento do ciclo, não o começo.

## Recomendação

Começar e terminar a **Fase 1** primeiro (pequena, isolada, sem risco pro resto do sistema) e só depois
decidir se a Fase 2 é realmente necessária — ela tem implicação jurídica/contratual que merece conversa
separada, não é uma decisão técnica que eu deva tomar sozinho.
