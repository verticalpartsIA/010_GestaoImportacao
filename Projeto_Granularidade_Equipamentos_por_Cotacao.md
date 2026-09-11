# Projeto: Granularidade de valor por equipamento (Precificação → Proposta → Contrato)

Status: **diagnóstico concluído, nada implementado ainda** — aguardando aval pra iniciar a Fase 1.

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

### Fase 2 — Contrato de Venda (maior, separada, precisa de decisão de negócio antes)
Hoje o contrato tem uma cláusula de "valor total". Levar o valor por equipamento até o Contrato
implica decidir: o contrato deve discriminar o preço de cada elevador individualmente na cláusula de
pagamento (mudança de texto jurídico, não só de código), ou o valor total continua sendo o que importa
legalmente e só a Proposta interna precisa ser granular? Essa é uma pergunta de negócio, não técnica —
recomendo não iniciar essa fase até você confirmar se isso é necessário (ex.: pra rastrear reembolso ou
desconto perpetuado individualmente até o contrato).

### Fase 3 — Diário de Obra / Instalação (provavelmente não precisa)
Diário de Obra e Instalação já referenciam o equipamento individual pra fins de identificação/execução
(via `montarAtivos()`), só não pra valor — e não parecem precisar de valor (são módulos operacionais,
não financeiros). Recomendo não mexer aqui a menos que surja um caso de uso concreto que precise disso.

## Recomendação

Começar e terminar a **Fase 1** primeiro (pequena, isolada, sem risco pro resto do sistema) e só depois
decidir se a Fase 2 é realmente necessária — ela tem implicação jurídica/contratual que merece conversa
separada, não é uma decisão técnica que eu deva tomar sozinho.
