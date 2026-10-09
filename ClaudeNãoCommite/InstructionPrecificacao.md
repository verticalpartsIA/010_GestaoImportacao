# Precificação Elevador — Especificação Técnica

**Arquivos:** `src/precificacao-elevador.jsx` (908 linhas) + `-store.js` (607 linhas) + `-engine.js` (304 linhas, com testes)  
**Propósito:** Financeiro/Admin calcula preço de venda (custo econômico + margem + DIFAL) a partir da resposta do fornecedor, aprova, e dispara Proposta automática

---

## ⚡ Essência

| Aspecto | Valor |
|--------|-------|
| **O quê** | Herda Formulário+resposta do Fornecedor → motor de cálculo (V1/V2) + DIFAL → aprovação → Proposta |
| **Quem usa** | Financeiro/Admin (rota travada: `precificacao: ["financeiro", "admin"]` em `app.jsx` L314) |
| **Saída** | `precificacoes_elevador` → `propostas` (automático ao aprovar) |
| **Motor oficial** | V2 ("custo econômico completo", desde 29/08) — V1 mantido só de comparação/fallback |
| **Dependência** | `PrecificacaoElevadorEngine`, `DifalEngine`, `CadastroCustosStore`, `PropostaHeranca`, `PropostaStore` |

---

## 📊 Estrutura de Dados (`precificacoes_elevador`)

```json
{
  "id": "uuid",
  "formulario_elevador_id": "uuid",
  "cotacao_fornecedor_id": "uuid|null",     // null = fluxo "direto pra Precificação"
  "numero_cotacao": 842,
  "status": "rascunho|calculado|finalizado", // finalizado = aprovado

  "vmle_usd": "float",                       // soma dos preco_total do fornecedor
  "tx_cambial": "float",
  "seguro_usd": "float", "siscomex_rs": "float",
  "frete_seguro_capatazia_usd": "float",
  "frete_seguro_capatazia_usd_expresso": "float|null", // cenário 90 dias (container exclusivo)
  "outras_despesas_importacao_rs": "float",
  "despachante_desembaraco_rs": "float", "demurrage_rs": "float",
  "frete_interno_rs": "float", "armazenagem_rs": "float",

  "modelos": [{ "unidadeId", "identificador", "modelo", "quantidade", "valorUnitarioUsd", "tracao", "capacidadeKg", "paradas" }],
  "mo_lookup": "[resultado de buscarMaoDeObraAutomatica]",
  "containers": "[{tipo_tamanho, quantidade, preco_rs}]",  // via parseContainerNo()
  "itens_instalacao_montagem": "[...]",       // manual (ART, andaime/munck, frete instalador...)
  "itens_despesas_extras": "[...]",

  "percentual_servicos": "float", "mark_up_pct": "float",
  "comissao_consultoria_pct": "float", "comissao_vendedor_pct": "float", "comissao_indicacao_pct": "float",
  "modo_formacao_preco": "string", "margem_desejada_pct": "float|null",
  "contingencia_valor": "float", "outros_custos_nao_recuperaveis_rs": "float",

  "cambio_na_cotacao_usd_brl": "float|null",  // congelado, nunca reescrito depois de setado
  "parametros_fiscais_snapshot": "{margem_minima_pct, ...}",

  "resultado": "{...} (V1)",
  "resultado_v2": "{...} (V2, motor oficial)",
  "resultado_v2_expresso": "{...} (cenário 90 dias, opcional)",
  "difal": "{...}",

  "aprovado_em": "timestamp|null", "aprovado_por": "email|null"
}
```

---

## 🔄 Fluxo Completo

```
PrecificacaoElevadorStore.listarPendentes() [L202]
  ├─ Fila: cotações fornecedor com status IN (respondido, em_analise, aprovada)
  └─ + formulários "direto pra Precificação" (envio_direto_precificacao_em)

criar() → montarRascunho(formularioId, cotacaoFornecedorId) [L257]
  ├─ Com cotacaoFornecedorId: puxa preco_unitario/total real + câmbio congelado
  │    + parseContainerNo(container_no) + buscarMaoDeObraAutomatica(modelos)
  └─ Sem (direto): modelos nascem zerados, Financeiro digita à mão

Financeiro edita campos manuais (frete, seguro, comissões, itens de instalação...)
  │
  └─ "Calcular" → calcularEsalvar(id) [L381]
       ├─ Passada 1: PrecificacaoElevadorEngine.calcular() SEM DIFAL → "Valor da Operação" de referência
       ├─ DifalEngine.calcular() usa esse valor pra decidir se DIFAL é da VerticalParts
       ├─ Passada 2: recalcula COM difalCustoRs (se aplicável)
       ├─ calcularV2() roda em paralelo (custo econômico completo) — motor oficial
       ├─ calcularV2() de novo se frete expresso preenchido (cenário 90 dias)
       └─ salvar({resultado, resultado_v2, resultado_v2_expresso, difal, status:'calculado'})

"Aprovar precificação" → aprovar(id, {forcarAbaixoMinima}) [L487]
  ├─ Exige: resultado existe + camposObrigatoriosFaltando() vazio
  │    (VMLE, câmbio, modelos, itens_instalacao_montagem, comissao_vendedor_pct)
  ├─ Valida margem V2 (ou V1 fallback) >= margem_minima_pct
  │    Abaixo da mínima SEM forcar → throw com margemAbaixoMinima:true
  │    UI (.jsx L402-403): window.confirm() simples → aprovar(true) se usuário confirma
  ├─ status → 'finalizado', aprovado_em, aprovado_por
  └─ criarPropostaAutomatica(pz) [L529] — idempotente, Proposta nasce editável

Proposta criada → vendedor revisa → dispara pro cliente
```

---

## 🏗️ Componentes/Funções Principais

| Nome | Linha | Responsabilidade |
|------|-------|-------------------|
| `PrecificacaoElevadorPage` | .jsx L127 | Tela principal (Financeiro/Admin) |
| `montarRascunho` | store L257 | Snapshot inicial (fornecedor real OU direto zerado) |
| `calcularEsalvar` | store L381 | Motor V1+V2+DIFAL, 2 passadas |
| `camposObrigatoriosFaltando` | store L467 | Gate antes de aprovar |
| `aprovar` | store L487 | Trava margem mínima + cria Proposta automática |
| `ressincronizarDoFornecedor` | store L563 | Puxa dados novos do fornecedor (dry-run + confirm) |
| `buscarMaoDeObraAutomatica` | store L105 | Lookup MO por tração×capacidade×paradas |
| `PrecificacaoElevadorEngine` | -engine.js | Motor puro de cálculo (V1 `calcular`, V2 `calcularV2`) — testado |
| `DifalEngine` | (externo) | Cálculo de DIFAL por UF origem/destino |

---

## 🔐 Avisos Críticos

### ⚠️ Motor V1 vs V2 (decisão 29/08)
- **V2 é oficial** desde 29/08 — V1 "deixava markup positivo conviver com margem real negativa" (comentário L494-495)
- Precificações antigas sem `resultado_v2` (nunca recalculadas) caem pro V1 como fallback — não travam aprovação por dado que nunca existiu
- **Cuidado ao ler `margemFinal`/`margemEfetivaPct`**: sempre checar qual motor gerou antes de comparar entre precificações diferentes

### ⚠️ `margem_desejada_pct` null vira fallback silencioso
- Precificação criada antes da coluna existir → `null` (sem default na migration)
- `calcularEsalvar()` L433: `pz.margem_desejada_pct != null ? pz.margem_desejada_pct : (params.margemMinimaPct || 0.2)`
- Sem esse fallback, `Number(null)||0` faria o preço/margem V2 sair artificialmente baixo — já corrigido, mas atenção se mexer nesse trecho

### ⚠️ Câmbio congelado (`cambio_na_cotacao_usd_brl`)
- Só preenche se ainda vazio; depois de setado **nunca reescreve** (mesmo em ressincronização)
- Serve pra comparar depois "câmbio no dia da cotação vs. câmbio agora"

### ⚠️ Container só chega até aqui (ver Formulário Elevador)
- `parseContainerNo()` (L23-34) estrutura `respostas.container_no` pro card "Despesas Operacionais"
- **Não propaga pra Embarques-Importação** — ver `InstructionFormulárioElevador.md`, issue [#384](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/384)

### 🆕 ACHADO #1: Forçar abaixo da margem mínima não deixa rastro de auditoria
- **Onde:** `.jsx` L402-403 (`window.confirm()` simples) → `store.aprovar(id, {forcarAbaixoMinima: true})`
- **Problema:** o registro salvo (`status:'finalizado', aprovado_em, aprovado_por`) é **idêntico** a uma aprovação normal — não existe campo tipo `margem_forcada`/`forcado_motivo`, nem log em `VPLog`/`EventosFluxo` (grep confirma zero ocorrências)
- **Consequência:** alguém pode aprovar uma venda com margem abaixo do mínimo (inclusive negativa) e isso fica indistinguível de uma aprovação normal, exceto comparando manualmente `margemFinal` vs `margemMinima` nos dados congelados
- **Mitigação parcial existente:** rota travada a perfis `financeiro`/`admin` (`app.jsx` L314) — mas dentro desses perfis, qualquer um pode forçar sozinho, sem segunda aprovação (diferente do gate de 4 aprovações que existe para iniciar compra do fornecedor, ver `AvalFinanceiroStore.podeIniciarCompra`)
- **Sugestão de correção (não aplicada):** gravar `margem_forcada: true` + `forcado_motivo` (texto obrigatório no confirm) + registrar em `VPLog`/`EventosFluxo` quando `forcarAbaixoMinima` for usado

### 🆕 ACHADO #2: Precificação aprovada continua 100% editável e recalculável
- **Onde:** nenhum botão do `.jsx` usa `disabled={aprovado}` (grep confirma zero ocorrências) — `aprovado = pz.status === 'finalizado'` (L393) existe como variável mas **não trava nada na UI**
- **Botões que continuam ativos após aprovação:** "Salvar rascunho" (L442), "Calcular" (L443, reescreve `resultado`/`resultado_v2`/`difal`), "Ressincronizar do fornecedor" (L469, sobrescreve `modelos`/`vmle_usd`), "Recalcular MO" (L517), edição de campos manuais
- **Consequência:** depois que uma Precificação é aprovada e **já disparou a criação automática da Proposta** (`criarPropostaAutomatica`), alguém ainda pode mudar os números por trás — a Proposta já criada (possivelmente já enviada ao cliente) fica dessincronizada da Precificação que a originou, sem nenhum aviso
- **Contradiz o comentário do próprio código** (store L465-466): *"Aprovar congela o snapshot que a Proposta vai usar"* — na prática, só a Proposta em si fica congelada; a Precificação de origem não
- **Sugestão de correção (não aplicada):** bloquear (`disabled`) os controles de edição/recálculo/ressincronização quando `pz.status === 'finalizado'`, exigindo uma ação explícita tipo "Reabrir para edição" (que poderia voltar `status` pra `'calculado'` e avisar se já existe Proposta vinculada)

### ⚠️ Avisos de dado implausível (já tratados, não são bugs)
- Câmbio fora da faixa 1–20 R$/US$ → aviso visual (`cambioForaFaixa`, L413) — comum ser troca de campo (taxa/frete digitado no câmbio)
- Mark-up ≥ 100% → zera o preço de venda, aviso específico (`markUpForaFaixa`, L420)
- Preço de venda > 50× o FOB esperado → aviso de resultado implausível (L423)

---

## 🔗 Integração

| Módulo | Direção | Campo/Mecanismo |
|--------|---------|------------------|
| Formulário Elevador + RFQ Fornecedor | ← entrada | `montarRascunho()` puxa `formularios_elevador` + `cotacoes_elevador_fornecedor.respostas` |
| Cadastro de Custos (MO) | ← entrada | `buscarMaoDeObraAutomatica()` via `CadastroCustosStore.buscarCustoElevador(tracao, capacidadeKg, paradas)` |
| Aval Financeiro (CEO) | → relacionado | `itens_instalacao_montagem` vira "teto de custo" que o CEO aprova depois (`aval-financeiro-store.js`) |
| Proposta | → saída automática | `criarPropostaAutomatica()` ao aprovar — idempotente por `numero_cotacao` |
| Embarques-Importação | ✗ sem conexão | `containers` não propaga (ver Achado no Formulário Elevador) |

---

## 📍 Localização Crítica

- **Store:** `classificarMaoDeObraUnidade` (L47), `buscarMaoDeObraAutomatica` (L105), `montarRascunho` (L257), `calcularEsalvar` (L381), `camposObrigatoriosFaltando` (L467), `aprovar` (L487), `criarPropostaAutomatica` (L529), `ressincronizarDoFornecedor` (L563)
- **UI:** `PrecificacaoElevadorPage` (L127), `aprovado` (L393), `aprovar()` handler (L395-410), botões sem trava pós-aprovação (L442-517)
- **Engine:** `src/precificacao-elevador-engine.js` — `calcular()` (V1), `calcularV2()` (V2 oficial), com testes em `-engine.test.js`
