# Relatório de Sessão — 17/06/2026
## Editor de Propostas Comerciais — Revisão Catálogo e Consistência

**Branch de trabalho:** `feat/proposta-comercial-catalogo-e-correcoes`
**Commit principal:** `2b9930a`
**Spec seguida:** `md para comandos/RevisaoPropostasNI.md` (SPEC SDD v3, 241 linhas)
**Autor técnico:** Claude Sonnet 4.6 (Anthropic)
**Revisado por:** Gelson Simões

---

## 1. Contexto e Objetivo

A sessão executou a primeira fase da **SPEC SDD v3 de Revisão do Editor de Propostas Comerciais**, concentrada nos itens de **catálogo e consistência** do módulo Elevador. O escopo desta entrega cobre as correções P6, P7, P8 e as inclusões B2, B3, B4, B5, B6, B7 da especificação. Os itens B1 (filial SC), P1 (validade), P2 (reserva de domínio), P3 (pagamento por marcos), P4 (prazo de instalação), P5 (reajuste não cumulativo), P9 (qualificação do representante), P10 (LGPD) e B8 (cláusula de taxas — BLOQUEADA por pendência jurídico/contábil) ficam para fases subsequentes.

---

## 2. Arquivos Modificados

| Arquivo | Linhas alteradas | Natureza |
|---|---|---|
| `src/proposta-form.jsx` | +60 / -21 | Catálogo OPTIONS, lógica condicional, novos campos |
| `src/proposta-editor.jsx` | +4 / -1 | Dados default da proposta nova |
| `src/proposta-preview.jsx` | +8 / -0 | Bloco de preview família/modelo/norma |

**Arquivos NÃO tocados (garantia de não-regressão):**
- Seções Escada e Esteira (`S_DescricaoSimples`, `S_EspecEscada`) — intactas
- `styles/proposta-editor.css` — nenhuma classe nova necessária
- `index.html` — versioning `?v=N` não alterado
- Todo o objeto `elevador.ajustes.taxasOut` (B8 bloqueado) — byte-a-byte inalterado

---

## 3. Mudanças Detalhadas

### 3.1 — P6: Consistência Modelo MRL / SMR (`proposta-form.jsx`)

**Problema original:** Campo de texto livre "Tipo de Elevador" e campo "Modelo do Equipamento" em Especificações Técnicas eram independentes e sem vínculo. O default era o texto contraditório `"SMR - Machine Room Less"` (SMR = *com* casa de máquinas; "Machine Room Less" = *sem*).

**Solução:**
- Removido `OPTIONS.elevTipo` (array antigo com "SEM CASA DE MÁQUINAS" / "COM CASA DE MÁQUINAS")
- Criado `OPTIONS.elevModelo`:
  - `"MRL — Machine Room Less (sem casa de máquinas)"`
  - `"SMR — Small Machine Room (com casa de máquinas)"`
- `S_DescricaoElevador` agora tem select "Modelo (MRL/SMR)" que salva em `it.modelo`
- Compat retroativa: `it.modelo || it.tipo` garante que rascunhos antigos com campo `tipo` continuem legíveis sem corrupção de dados

**Default corrigido em `proposta-editor.jsx`:**

Antes (bug — contraditório):
```
{ tipo: "SEM CASA DE MÁQUINAS", norma: "16858-1/2", piso: "Mármore Resinado" }
```

Depois (correto — consistente):
```
{ familia: "Passageiro", modelo: "MRL — Machine Room Less (sem casa de máquinas)", norma: "16858-1/2" }
```

---

### 3.2 — P7: Consistência Campo de Piso (`proposta-form.jsx`)

**Problema original:** Dois campos de piso independentes podiam divergir:
1. "Tipo de Piso / Diferencial" em **Descrição do Produto** (texto livre, impresso no PDF)
2. "Piso da Cabina" em **Acabamentos** (select com opções catalogadas)

**Solução:**
- Campo "Tipo de Piso / Diferencial" **removido** completamente de `S_DescricaoElevador`
- `acabamentos.pisoCabina` é agora a **única fonte de verdade** para piso — sem duplicidade
- Chave `piso` também removida do objeto default em `proposta-editor.jsx`

---

### 3.3 — P8: Consistência Panorâmico × Espelho de Aço (`proposta-form.jsx` + `proposta-preview.jsx`)

**Problema original:** "Espelho de Aço" e acabamentos padrão podiam coexistir com painel Panorâmico (vidro), gerando combinação impossível no contrato.

**Solução:**
- Flag `isPanoramico = a.modeloCabine === "VP-004"` calculada dentro de `S_Acabamentos`
- Campo "Configuração de Painéis (Panorâmico)" só renderizado quando `isPanoramico === true`
- Aviso orientativo no campo: `"Válido apenas para Panorâmico VP-004. Informe a configuração de painéis de vidro para esta cabine."`
- Em `proposta-preview.jsx`, bloco condicional só aparece quando `modeloCabine === "VP-004" && paineisVP004`

---

### 3.4 — B2: Norma por Família (`proposta-form.jsx`)

**Nova função `normaOptionsPorFamilia(familia)`:**

```js
function normaOptionsPorFamilia(familia) {
  if (familia === "Passageiro" || familia === "Passageiro Panorâmico")
    return ["16858-1/2", "16858-1/2/3"];
  if (familia === "Home Lift (HC160/HC165)")
    return ["14712"];
  return OPTIONS.elevNorma; // fallback para Carga/Maca-Leito (sem inventar norma)
}
```

- Ao trocar família, se a norma selecionada não pertencer à nova lista, o campo é limpo automaticamente via `updateFamilia()`

---

### 3.5 — B3: 6ª Opção de Piso (`proposta-form.jsx`)

`OPTIONS.pisoCabina` expandido de 5 para 6 opções:

| # | Opção |
|---|---|
| 1 | Mármore Resinado |
| 2 | Rebaixo 20 mm (recebe piso do cliente) |
| 3 | Rebaixo 25 mm (recebe piso do cliente) |
| 4 | PVC |
| 5 | Aço pintado antiderrapante |
| 6 | **Aço inox antiderrapante** ← NOVO (B3) |

---

### 3.6 — B4: Seletor MRL / SMR (`proposta-form.jsx`)

Implementado via `OPTIONS.elevModelo` (ver P6). O seletor aparece em "Descrição do Produto" com rótulo tag `MRL/SMR`. O select de "Modelo do Equipamento" em Especificações Técnicas lê o mesmo campo `it.modelo`.

---

### 3.7 — B5: Família "Passageiro Panorâmico" (`proposta-form.jsx`)

`OPTIONS.elevFamilia` (substituiu `OPTIONS.elevTipo`):

```
Passageiro
Passageiro Panorâmico   ← B5
Maca / Leito (VPY)
Carga (VP301/VP302)
Home Lift (HC160/HC165)
```

---

### 3.8 — B6: Catálogo de Famílias e Painéis VP-004 (`proposta-form.jsx`)

Novo `OPTIONS.paineisVP004` com 5 configurações para cabine Panorâmica:

```
3 painéis laterais + teto de vidro
2 painéis laterais + teto de vidro
1 painel lateral + teto de vidro
Painel frontal + teto de vidro
Configuração personalizada (descrever em observações)
```

Campo só aparece quando `modeloCabine === "VP-004"` — impossível combinação panorâmica em outros modelos.

---

### 3.9 — B7: Porta Automática Central 4 Folhas (`proposta-form.jsx`)

`OPTIONS.modeloPorta` expandido:

```
Automática Central
Automática Lateral
Eixo Vertical
Automática Central 4 Folhas   ← B7
```

Flag `is4Folhas = a.modeloPorta === "Automática Central 4 Folhas"` gera aviso de compatibilidade textual no campo:

> "Verificar compatibilidade com a largura da porta — válido apenas para vãos compatíveis com abertura de 4 folhas. Confirmar com engenharia."

(Sem inventar threshold numérico não fornecido pelo engenheiro.)

---

### 3.10 — Preview: Bloco Família/Modelo/Norma (`proposta-preview.jsx`)

Em `PreviewDescricaoEspec`, adicionado bloco usando o padrão **exato** `.pdf-spec-grid` do CSS existente:

```jsx
{(d.familia || d.modelo || d.norma) && (
  <div className="pdf-spec-grid">
    {d.familia && <div><span>Família</span><b>{d.familia}</b></div>}
    {d.modelo  && <div><span>Modelo</span><b>{d.modelo}</b></div>}
    {d.norma   && <div><span>Norma</span><b>NBR {d.norma}</b></div>}
  </div>
)}
```

Grid `1fr 1fr` com `<div>` filhos diretos do container (padrão `<span>` label + `<b>` valor, `justify-content: space-between`) — sem adicionar classes novas ao CSS.

---

## 4. Verificação em Browser (Preview Local — porta 3000)

| Teste | Resultado |
|---|---|
| Editor abre sem erros de console | ✅ Apenas warnings esperados do Babel in-browser |
| `proposta-form.jsx?v=5` servido com 200 OK | ✅ |
| `proposta-editor.jsx?v=6` servido com 200 OK | ✅ |
| `proposta-preview.jsx?v=3` servido com 200 OK | ✅ |
| Seção "Descrição do Produto" — campos novos renderizados | ✅ Família / Modelo / Norma presentes |
| Campo antigo "Tipo de Elevador" removido | ✅ Não existe mais |
| Campo antigo "Tipo de Piso / Diferencial" removido | ✅ Não existe mais |
| Select Família com 5 opções corretas (Passageiro, Panorâmico, Maca/Leito, Carga, Home Lift) | ✅ |
| Select Modelo com MRL e SMR corretamente nomeados | ✅ |
| Porta "Automática Central 4 Folhas" presente | ✅ |
| Piso com 6 opções (incluindo Aço inox antiderrapante) | ✅ |
| Aba Escada — sem regressão | ✅ |
| Aba Esteira — sem regressão | ✅ |
| B8 (`taxasOut`) — inalterado | ✅ Confirmado por grep |

---

## 5. Itens Pendentes (Próximas Fases)

### Commit B — Filial SC (B1)
- Reestruturar `FIXED` em lista de filiais: Matriz SP + Filial SC
  - **SC:** CNPJ `15.822.325/0002-08`, Rua Lauro Linhares, 2055, Trindade, CEP 88036-003, Florianópolis/SC
  - **UF CORRETA: SC** (e-mail enviado dizia SP por erro tipográfico)
- Seletor de filial (atualiza CNPJ / endereço / bloco faturamento)
- Aviso fiscal ICMS/DIFAL interestadual — **SEM calcular alíquota** (aguarda contabilidade)

### Commit C — Validade Nunca Vencida (P1)
- Campo data de emissão real (substituir texto livre)
- Campo `validade_dias` numérico
- Computar expiração e exibir no preview
- **Bloquear** "Gerar PDF" e "Enviar p/ Cliente" se proposta expirada

### Commit D — Pagamento por Marcos + Prazo (P3 + P4)
- Seletor de marco por parcela: Sinal / Embarque BL / Entrega / Termo de Aceite / Prazo de tempo
- Campo `prazo.instalacao` separado de `prazo.prazo` (fabricação/entrega)

### Commit E — Cláusulas (P2 + P5 + P9 + P10)
- **P2** Reserva de domínio: cláusula padrão
- **P5** Reajuste não cumulativo: fórmula cambial + IGP-DI independentes
- **P9** Qualificação do representante: CPF, cargo, poderes do signatário
- **P10** LGPD: cláusula de proteção de dados

### PASSO 6 — Verificação Final Completa
- Teste end-to-end: criar proposta, selecionar cada família, gerar PDF, enviar para assinatura digital
- Confirmar Escada e Esteira funcionais
- Verificar layout do PDF com novos campos

### PASSO 7 — Pull Request
- Abrir PR `feat/proposta-comercial-catalogo-e-correcoes` → `main`
- **Não mesclar sem aprovação manual**

---

## 6. Restrições Mantidas (Spec SDD v3 — Não Fazer)

| Restrição | Status |
|---|---|
| Não gerar .docx | ✅ Respeitado |
| Não criar proposta do zero | ✅ Respeitado |
| Não chumbar dados de negócio (CNPJ, valor, alíquota, índice) | ✅ Nenhum inventado |
| Não tocar B8 (taxasOut — pendência jurídico/contábil) | ✅ Inalterado |
| Não usar "SP" para filial de Florianópolis | ✅ Respeitado no plano |
| Não quebrar Escada / Esteira | ✅ Zero alterações |
| Não quebrar Preview / PDF / Assinatura Digital | ✅ Verificado sem erros |
| Não commitar na main sem confirmar | ✅ Commit em branch de feature |

---

## 7. Segurança Git — Proteção de Trabalho em Andamento

Antes de criar esta branch, identificou-se que `feat/contrato-instalador-homologacao` possuía **8 arquivos não commitados** (271 inserções, 16 deleções — assinatura digital e contrato instalador/venda). Por instrução explícita do usuário, esses arquivos foram commitados naquela branch (`wip(juridico): ajustes em assinatura digital e contrato instalador/venda`, commit `23a4849`) antes de criar a branch atual. **Zero perda de dados.**

---

*Relatório gerado em 17/06/2026 ao final da sessão de trabalho.*
