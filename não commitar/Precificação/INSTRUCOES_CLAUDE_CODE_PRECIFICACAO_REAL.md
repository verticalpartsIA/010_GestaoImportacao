# Tarefa: transformar a Precificação em um cálculo real, completo e auditável

## Contexto do projeto

- Repositório: `https://github.com/verticalpartsIA/010_GestaoImportacao.git`
- Projeto local esperado: `C:\Users\gelso\OneDrive\Área de Trabalho\SitesProjetos\010_GestaoImportacao`
- Tela: `https://vpgestaoimportacao.vpsistema.com/comercial/precificacao`
- Assunto: precificação de elevadores, escadas rolantes e esteiras.
- Referências de negócio: `Modelo Pricing Elevador.xlsx` e `Modelo Pricing Escada.xlsx`.
- Arquivo de regras desta tarefa: `regras_precificacao_real.json`.

## Instruções obrigatórias ao Claude Code

1. Leia este documento e o JSON integralmente antes de editar qualquer arquivo.
2. Inspecione a implementação atual, principalmente:
   - `src/precificacao-elevador-engine.js`
   - `src/precificacao-elevador.jsx`
   - `src/precificacao-elevador-store.js`
   - testes, migrations e tabelas Supabase relacionadas à precificação.
3. Preserve dados existentes e compatibilidade com precificações já gravadas.
4. Não altere regras tributárias sem documentar a origem e criar testes.
5. Não faça commit, push, merge ou deploy. Entregue as alterações apenas no diretório local para revisão.
6. Antes de implementar, apresente um diagnóstico curto dos arquivos que serão alterados.

## Problema central

O sistema já calcula importação, impostos, créditos, comissões, preço, lucro e margem. Porém, replica uma fragilidade da planilha: instalação, frete interno, armazenagem e outras despesas operacionais entram no desembolso e são descontados posteriormente do lucro, mas não compõem a base usada para formar o preço de venda.

Consequência: uma precificação pode exibir markup positivo e gerar margem negativa.

O sistema precisa formar o preço usando o custo econômico completo, validar a origem de cada custo e impedir que uma proposta aparentemente rentável seja, na prática, deficitária.

## Objetivos

1. Criar uma base única de custo completo.
2. Separar corretamente markup sobre custo de margem desejada sobre venda.
3. Automatizar a consulta das tabelas de mão de obra.
4. Estruturar logística e frete com origem, validade e necessidade de recotação.
5. Tratar configurações fora das tabelas como projetos especiais.
6. Implementar alertas, bloqueios, justificativas, aprovação e histórico.
7. Manter o cálculo rastreável: todo valor deve indicar fonte, situação e data de referência.

## Regra financeira principal

### Custo econômico completo

Criar uma variável explícita, sem reutilizar um nome ambíguo:

```text
custo_economico_completo =
  custo_liquido_importacao
  + despesas_operacionais
  + instalacao_montagem
  + logistica_interna
  + contingencia_valor
  + outros_custos_nao_recuperaveis
```

Não incluir créditos tributários inexistentes ou não aproveitáveis. O regime tributário e a elegibilidade do crédito precisam permanecer explícitos.

### Dois modos comerciais distintos

#### Markup sobre custo

```text
preco_antes_despesas_percentuais = custo_economico_completo * (1 + markup_pct)
```

Se impostos, comissões ou outros custos forem percentuais do preço de venda, resolver o preço pelo divisor correspondente, sem contá-los duas vezes.

#### Margem desejada sobre venda

```text
preco_venda = custos_fixos_totais /
  (1 - margem_desejada_pct - percentuais_incidentes_sobre_venda)
```

O sistema deve impedir divisor menor ou igual a zero.

### Terminologia obrigatória na interface

- `Markup sobre o custo (%)`
- `Margem desejada sobre a venda (%)`
- `Margem efetiva calculada (%)`

Nunca exibir apenas `MARK-UP` quando a fórmula estiver usando margem no divisor.

## Estrutura proposta para o formulário

### 1. Identificação

- Cotação, lead, cliente e empreendimento.
- Tipo de equipamento.
- Responsável pela precificação.
- Quantidade total.
- Data-base e validade.
- Moeda e taxa cambial.
- Status: rascunho, calculado, pendente, em aprovação, aprovado, rejeitado ou expirado.

### 2. Equipamentos e fornecedor

- Modelo, quantidade e valor unitário em moeda estrangeira.
- Valor total por modelo.
- Incoterm.
- País, porto e fornecedor.
- Seguro, frete internacional e capatazia.
- Rateio proporcional por modelo.
- Validação: soma das quantidades dos modelos deve ser igual à quantidade total.

### 3. Importação e tributos

- VMLE, VMLD, Siscomex e AFRMM.
- II, IPI, PIS, COFINS e ICMS de importação.
- Regime tributário.
- Ex-tarifário: aplicável, número, validade e evidência.
- Créditos tributários com indicador de elegibilidade.
- Outras despesas que compõem a base do ICMS.

### 4. Mão de obra e instalação

#### Elevador

- Tração.
- Capacidade em kg.
- Número de paradas.
- Quantidade de acessos, quando aplicável.
- Tipo de instalação.
- Valor encontrado na tabela.
- Regra usada, faixa consultada, reajuste e data-base.

Busca primária:

```text
tração + faixa de capacidade + paradas
```

#### Escada e esteira

- Tipo: escada ou esteira.
- Inclinação.
- Desnível vertical (VR).
- Comprimento.
- Quantidade.
- Quantidade e tipo de contêineres.
- Descarga.
- Valor encontrado na tabela.

Busca primária:

```text
tipo + inclinação + desnível vertical + quantidade
```

#### Custos complementares

- Equipe e quantidade de montadores.
- Dias de montagem.
- Passagens, hospedagem, alimentação, combustível, pedágio e veículo.
- Andaime, guincho, talha, munck, empilhadeira e paleteira.
- Ajudantes.
- Material de instalação.
- ART, documentação e seguro-garantia.
- Descrição, quantidade, unidade, valor unitário e total para cada item.

### 5. Logística

- Origem e destino.
- Transportadora.
- Modalidade e tipo de veículo.
- Distância fora da capital.
- Quantidade e tipo de contêineres.
- Valor da carga.
- Ad valorem, pedágio, seguro e adicionais.
- Data e validade da cotação.
- Necessidade de nova cotação.

Não transformar a tabela histórica de frete em verdade permanente. Ela deve ser uma referência com validade e fonte.

### 6. Despesas operacionais

- Despachante e desembaraço.
- Demurrage.
- Armazenagem.
- Frete interno.
- Contêineres.
- Instalação e montagem.
- Itens adicionais estruturados.
- Contingência em valor ou percentual.

### 7. Formação do preço

- Percentual de produto e serviço.
- Impostos da venda do produto.
- Impostos sobre serviços.
- Comissões por beneficiário.
- Modo de formação: markup ou margem desejada.
- Percentual informado.
- Custo econômico completo.
- Preço mínimo sem prejuízo.
- Preço recomendado.
- Preço comercial informado, se houver override.
- Margem efetiva.
- Lucro total e por equipamento.

### 8. Auditoria e aprovação

Para todo custo, armazenar:

- Origem: sistema, tabela, fornecedor, cotação externa, estimativa ou manual.
- Situação: confirmado, herdado, estimado, pendente ou expirado.
- Data-base e validade.
- Responsável.
- Evidência ou referência.
- Justificativa de alteração manual.

Registrar versões e comparação entre valor anterior e novo.

## Projetos especiais e extrapolação

Quando a configuração não existir na tabela, não retornar silenciosamente o último preço conhecido.

Exemplo: elevador 2:1, 43 paradas e 6.000 kg.

O sistema deve:

1. Marcar `projeto_especial = true`.
2. Mostrar quais parâmetros ficaram fora da cobertura.
3. Oferecer estimativa somente se existir uma metodologia versionada.
4. Identificar a estimativa como não confirmada.
5. Exigir justificativa e aprovação técnica/financeira antes da aprovação comercial.
6. Permitir anexar cotação de instalador ou engenharia.

Não usar extrapolação linear indiscriminada para capacidade, paradas ou tração.

## Alertas e bloqueios mínimos

Bloquear aprovação quando:

- Margem efetiva for negativa.
- Divisor da formação do preço for menor ou igual a zero.
- Quantidade total divergir da soma dos modelos.
- Existir custo obrigatório pendente.
- Projeto especial não tiver aprovação.
- Cotação externa estiver expirada.
- Taxa cambial estiver ausente ou inválida.
- Percentual de produto mais serviço for diferente de 100%.

Alertar, exigindo justificativa, quando:

- Margem estiver abaixo do piso configurado.
- Houver override manual.
- Valor estiver fora da faixa histórica.
- Contingência estiver zerada em projeto especial.
- Fonte do custo for apenas estimativa.

## Persistência e compatibilidade

1. Criar migrations aditivas e reversíveis.
2. Não apagar nem reinterpretar silenciosamente dados históricos.
3. Manter o resultado do motor legado disponível para comparação durante a transição.
4. Gravar `versao_motor_calculo` e `modo_formacao_preco` em cada cálculo.
5. Armazenar snapshot dos parâmetros e custos utilizados na aprovação.
6. Não depender de tabelas externas mutáveis para reproduzir uma precificação antiga.

## Plano de implementação recomendado

### Fase 1 — diagnóstico e testes de caracterização

- Mapear campos existentes da tela até banco e motor.
- Criar testes que reproduzam os exemplos das duas planilhas.
- Demonstrar em teste que o modelo legado pode gerar margem negativa.
- Documentar divergências sem alterar o comportamento ainda.

### Fase 2 — motor de custo completo

- Criar cálculo V2 isolado e puro.
- Implementar markup e margem como modos distintos.
- Incluir todos os custos relevantes na formação do preço.
- Produzir memória de cálculo estruturada.

### Fase 3 — tabelas parametrizadas

- Criar tabelas/versionamento para MO de elevadores, escadas e esteiras.
- Criar serviço de consulta com retorno da regra e fonte utilizadas.
- Implementar projeto especial e aprovação.

### Fase 4 — interface e validações

- Reorganizar o formulário pelas seções deste documento.
- Exibir confirmado, estimado, pendente e expirado.
- Exibir preço mínimo, recomendado, lucro e margem efetiva.
- Implementar alertas e bloqueios.

### Fase 5 — migração controlada

- Comparar V1 e V2 lado a lado em ambiente de teste.
- Validar casos com Financeiro.
- Somente após aceite, tornar V2 o padrão.

## Testes obrigatórios

Criar testes unitários e de integração cobrindo:

1. Custo operacional maior aumenta o preço recomendado.
2. Aumento de mão de obra aumenta o preço recomendado.
3. Markup e margem produzem resultados diferentes e corretos.
4. Margem negativa bloqueia aprovação.
5. Quantidade divergente bloqueia aprovação.
6. Projeto fora da tabela não recebe preço confirmado automaticamente.
7. Alteração de câmbio recalcula toda a cadeia.
8. Créditos respeitam o regime tributário.
9. Produto + serviço totaliza 100%.
10. Rateio por modelos preserva o preço total.
11. Cálculo aprovado pode ser reproduzido com seu snapshot.
12. Dados legados continuam acessíveis.

## Critérios de aceite

A tarefa será considerada concluída apenas quando:

- O preço recomendado considerar o custo econômico completo.
- Não houver ambiguidade entre markup e margem.
- A tela indicar a origem e a situação de cada custo.
- A consulta de MO retornar regra, valor, versão e data-base.
- Casos fora das tabelas forem tratados como projeto especial.
- Quantidades e rateios forem validados.
- Margem negativa impedir aprovação.
- A memória de cálculo puder explicar cada parcela do preço.
- Os testes novos e existentes passarem.
- Houver relatório final com arquivos alterados, migrations, testes executados, resultados e pontos pendentes.

## Entrega esperada do Claude Code

Ao terminar, apresente:

1. Diagnóstico encontrado.
2. Arquivos alterados.
3. Migrations criadas.
4. Fórmulas implementadas.
5. Testes criados e resultados.
6. Comparação entre cálculo legado e V2.
7. Riscos ou decisões que ainda dependem do Financeiro.
8. Confirmação explícita de que nenhum commit, push ou deploy foi executado.

