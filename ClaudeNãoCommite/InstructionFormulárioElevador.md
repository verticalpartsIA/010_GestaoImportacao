# Formulário Elevador — Especificação Técnica

**Arquivo:** `src/formulario-elevador.jsx` (1667 linhas)  
**Propósito:** Coleta estruturada de dados da obra + especificações técnicas de elevadores/escadas/esteiras  
**Canais:** Assistido (interno, Canal 1) | Self-Service (público, Canal 2 via link)

---

## ⚡ Essência

| Aspecto | Valor |
|--------|-------|
| **O quê** | Formulário com 2 cabeçalhos (cliente + obra) + N unidades (equipamentos) |
| **Quem usa** | Vendedor (interno) ou Cliente (link público) |
| **Saída** | `formularios_elevador` (1 por cotação) + `formularios_elevador_unidades` (N por formulário) |
| **Integração** | Leads → Prefill \| RFQ para fornecedor \| Precificação (MO) \| Engenharia |
| **Dependência** | `FormularioElevadorStore`, `CadastrosClientesStore`, `MasterIdEngine`, `EnderecoAPI` |

---

## 📊 Estrutura de Dados

### Header (formularios_elevador)
```json
{
  "cliente_id": "uuid",
  "numero_cotacao": 842,              // gerado 1º save
  "canal": "assistido|self_service",
  "lead_id": "LD-123456|null",
  
  "tipo_pessoa": "PJ|PF",
  "razao_social": "string",
  "cnpj": "14dígitos|null",
  "cpf": "11dígitos|null",
  "telefone": "string|null",
  "email": "string|null",
  "contato": "string",
  "predio_empreendimento": "string",
  
  "endereco_logradouro": "string",
  "endereco_cep": "string",
  "endereco_cidade": "string",
  "endereco_estado": "2 chars",
  
  "local_obra_cidade": "string *",
  "local_obra_estado": "2 chars *",
  "endereco_obra_diferente": "false|true",
  
  "tipo_mao_de_obra": "verticalparts|cliente *",
  "responsavel_entrega": "cliente|verticalparts *",
  "status": "rascunho|enviado"
}
```

### Unidade (formularios_elevador_unidades)
```json
{
  "id": "uuid",
  "formulario_id": "uuid",
  "indice_ativo": 1,                  // auto-gerado, sequencial
  "identificador": "VPEL-EL0842-1",   // auto-sync após 1º save
  "tipo_equipamento": "elevador|escada|esteira",
  "quantidade": 1,
  
  /* Elevador específico */
  "tipo": "Passageiro|Carga|Hospitalar|...",
  "modelo": "código",
  "tracao": "2:1|4:1",
  "capacidade_kg": "número",
  "velocidade_ms": "número *",
  "paradas": "número *",
  "pavimentos_desc": "string *",
  "casa_maquinas": "com|sem",
  "agrupamento": "simplex|duplex|triplex|group",
  "porta_oposta": "Não|Sim",
  "estrutura_caixa": "Concreto|Alvenaria|Aço *",
  "percurso_mm": "número *",
  "porta_tipo_abertura": "Automática|Manual|outro *",
  "tensao_principal": "220V|380V|440V *",
  "tensao_iluminacao": "220V|110V|24V",
  
  /* Escada/Esteira (jsonb) */
  "especificacoes": { "desnivel_elevacao": "5.04 m", "inclinacao": "30°", ... }
}
```

---

## 🔄 Fluxo Dados

```
Lead (comercial.jsx) 
  ↓ __prefillFromLead
  ↓
Formulário Elevador (carrega)
  ├─ prefill contato/telefone/email/cliente_id
  ├─ lead_id gravado no header
  ↓
salvarTudo()
  ├─ 1º save: numero_cotacao gerado
  ├─ sync unidades sequencial: indice_ativo auto-gerado
  ├─ identificador → VPEL-EL{numero}-{indice}
  ↓
enviar() → status='enviado' → RFQ gerado
  ↓
Precificação (consulta tracao+paradas)
Engenharia (analisa observacoes+anexos)
Embarques (futuro: container_no)
```

---

## 🏗️ Componentes Principais

| Componente | Responsabilidade |
|-----------|-----------------|
| `FormularioElevadorPage` | Orquestra estado + save |
| `FEClientePicker` | Busca cliente (assistido) |
| `FEUnidadeCard` | 1 equipamento (accordion) |
| `FEEspecificacoesGenericas` | Campos escada/esteira |
| `FEAnexos` | Upload projeto civil |
| `FECotacaoFornecedorGrupo` | RFQ + respostas |

---

## 🔐 Avisos Críticos

### ⚠️ Prefill Lead
- **Herda:** contato, telefone, email, cliente_id (se existir)
- **NÃO herda:** equipamento (sempre vazio)
- Sem cliente_id → Formulário busca/cria inline
- **Bug histórico (E11):** trocar Lead mantinha cliente antigo na tela até resposta

### ⚠️ Identificador do Equipamento
- Antes 1º save: `E1`, `E2` (provisório)
- Após save: `VPEL-EL{numero_cotacao}-{indice_ativo}` (auto-sync)
- **MasterIdEngine:** mapeia tipo → categoria (elevador/escada_rolante/esteira_rolante)
- **Sem sync:** RFQ/Precificação recebem id desatualizado

### ⚠️ Validação Rascunho vs. Enviar
- **Rascunho:** só exige nome (NN banco) + ClientePicker
- **Enviar:** validação COMPLETA (11 campos * elevador)
- **Elevador *:** tipo, tracao, velocidade_ms, paradas, pavimentos_desc, casa_maquinas, agrupamento, porta_oposta, estrutura_caixa, percurso_mm, porta_tipo_abertura, tensao_principal, tensao_iluminacao
- **Escada/Esteira:** sem obrigatoriedade

### ⚠️ Sincronização Unidades
- **Sequencial** (não paralelo) propositalmente
- `adicionarUnidade()` calcula `indice_ativo` consultando banco
- Paralelo = risco 2+ unidades mesma index
- Sem `id` → insert \| Com `id` → update

### ⚠️ Anexos Salvam Rascunho
- Primeiro anexo em novo → auto-save via `garantirSalvo()`
- Self-service anexa projeto civil; assistido anexa pra fornecedor

### ⚠️ Opções Modelo
- Busca `listarOpcoesElevador(modelo)` → teto_falso/piso/porta/botoeiras
- Sem modelo → vazio
- Mudou modelo → refaz busca

### ⚠️ CNPJ Async Fill (OnBlur)
- Busca EnderecoAPI (público) **OU** cliente em Cadastros
- Não valida (fica pro store)

### ⚠️ Status Obra Diferente
- Checkbox "Será instalado em endereço diferente?"
- Se SIM → exige endereço completo
- Se NÃO → usa cliente

### ⚠️ Canais = Renderização Diferente
| Aspecto | Assistido | Self-Service |
|--------|-----------|-------------|
| Cliente | ClientePicker | Form inline |
| Origem/Vendedor | ✓ | ✗ |
| Fornecedor | Editável | Oculto |
| Duplicar | ✓ | ✗ |
| Gerar link | ✓ | ✗ |
| CSS | `page fade-in` | `fe-public` |

---

## 🔗 Integração

| Módulo | Campo |
|--------|-------|
| Leads | `__prefillFromLead` (contato/email/cliente_id) |
| RFQ | `formularios_elevador_unidades.id` |
| Precificação | `tracao + paradas` → MO lookup |
| Engenharia | `anexos.categoria='projeto_civil'` |
| Embarques | Futuro: `respostas.container_no` |

---

## 📦 FormularioElevadorStore

| Método | Retorna |
|--------|---------|
| `criar(header)` | `{id, numero_cotacao}` |
| `salvar(id, header)` | void |
| `obter(id)` | `{header, unidades}` |
| `buscarOuCriarCliente(data)` | `{id}` |
| `adicionarUnidade(id, payload)` | `{id, indice_ativo}` |
| `atualizarUnidade(id, payload)` | void |
| `listarOpcoesElevador(modelo)` | `{teto_falso, piso, ...}` |
| `enviar(id)` | void |
| `anexarArquivo(id, file, cat)` | `{id, path, tamanho_bytes}` |
| `listarAnexos(id, cat)` | `[...]` |
| `gerarLinkPublico(id)` | URL |

---

## 🎯 Fluxo: Novo Elevador

1. Abre via LeadsPage → prefill
2. Preenche dados cliente + obra (validação mín.)
3. "+ Adicionar equipamento" → novo card
4. Preenche elevador (tipo, modelo, tracao, velocidade, paradas, etc.)
5. "Salvar rascunho" → numero_cotacao gerado, identificador → VPEL-EL0842-1
6. "Enviar p/ Cotação" → validação completa, status='enviado', RFQ
7. Cliente recebe email c/ link
8. Vendedor visualiza em "Controle de Cotações"
9. Move para Precificação

---

## 🐛 Erros/Gaps Reais Encontrados (auditoria 26/09/2026)

### 1. Campo `fornecedor` da Unidade não é obrigatório mesmo no envio
- **Onde:** `validar()` (L1341-1360) — lista os 13 campos `*` obrigatórios do elevador; `fornecedor` não está lá
- **Consequência:** vendedor clica "Enviar para Cotação" (status='enviado', validação passa) sem preencher `fornecedor` em nenhuma unidade
- **Sintoma:** ao abrir depois "Enviar cotação a fornecedores" (`FECotacaoFornecedorModal`), o modal vem **vazio** — `grupos` (L984-1001) só inclui `unidades.filter((u) => u.id && u.fornecedor)`
- **Mitigação existente:** mensagem "Salve o formulário e defina o Fornecedor em pelo menos uma Unidade para enviar a cotação" (L1074) — mas só aparece dentro do modal, que o vendedor pode nem abrir
- **Risco:** vendedor pode achar que já enviou a cotação (clicou o botão certo) e o RFQ nunca sair de fato
- **Sugestão de correção (não aplicada):** warning (não bloqueio) no botão "Enviar para Cotação" se nenhuma unidade tiver `fornecedor` preenchido

### 2. `container_no` (resposta do fornecedor) não propaga para Embarques-Importação
- **Onde:** `parseContainerNo()` (`precificacao-elevador-store.js` L23-34) já estrutura o texto livre `respostas.container_no` em `{tipo_tamanho, quantidade, preco_rs:0}` e `montarRascunho()` (L309) já popula `containers` da Precificação com isso (card "Despesas Operacionais")
- **Gap real:** `embarques-importacao.jsx` (componente `EIContainers`, que já suporta múltiplos containers estruturados) inicializa `containers: []` sempre vazio (L206) — não lê nada de `precificacoes_elevador.containers` nem de `numero_cotacao`
- **Consequência:** logística redigita os containers do zero na hora de criar o embarque, mesmo já existindo essa informação estruturada 2 telas atrás
- **Sugestão de correção (não aplicada):** herdar `containers` (+ resto do contexto via `numero_cotacao`) na criação do embarque, no mesmo padrão que `PropostaHeranca.prefillPorNumeroCotacao` já faz pra Proposta
- **Nota:** CLAUDE.md principal (raiz do projeto) tinha uma entrada desatualizada sobre isso — corrigida em 26/09, ver seção "Pendências"

---

## 🚀 Próximas Fases

- Conectar `container_no` (fornecedor) → Embarques-Importação (ver Gap #2 acima)
- Auto-lookup MO na Precificação via `tracao + paradas`

---

## 📍 Localização

- **Const:** FE_TIPOS (L10), FE_TRACOES (L15), FE_SECOES_ESCADA/ESTEIRA (L54-178)
- **Templates:** feHeaderPick() (~L1270), feNovaUnidade() (L219)
- **Funções core:** salvarTudo() (L1365), validar() (L1341), feCodigoUnidade() (L213)
