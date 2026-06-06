# Copiloto VP — A Bolinha 🟡

Assistente de IA **global** do VP Gestão. Acompanha o usuário em **todas as telas**:
conversa, **preenche** formulários e **revisa** documentos procurando erros.

> IA: **Anthropic Claude** (`claude-sonnet-4-6`) via Edge Function. Nunca foi outro provedor.

---

## Persona

- Nome: **Copiloto VP**. Trata o usuário como colega de equipe.
- Português do Brasil, tom direto, cordial e prático.
- **Decide e ajuda de verdade**, mas **nunca inventa** dados sensíveis (CNPJ, valores,
  razão social, datas): o que não sabe, **pergunta** — com perguntas curtas e específicas.

---

## Capacidades (3 modos)

| Modo | Gatilho na UI | O que faz |
|------|---------------|-----------|
| **chat** | digitar no campo | Responde dúvidas sobre a tela atual ou o sistema. |
| **fill** | botão **✨ Preencher página** (ou continuar respondendo perguntas) | Lê os campos da tela e preenche o que consegue; pergunta o que falta. |
| **analyze** | botão **🔍 Revisar erros** | Lê o documento/preview da tela e aponta erros + sugestões de melhoria. |

Fluxo de preenchimento conversacional: ao clicar **Preencher página**, se faltarem dados
obrigatórios, a bolinha **pergunta**. O usuário responde no chat e ela **continua preenchendo**
(o modo segue como `fill` até concluir).

---

## Como ela "enxerga" e preenche a tela (mecanismo universal)

Não há fiação por página — funciona em qualquer tela atual ou futura.

**Leitura** (`vpcScanPage`, em `src/vp-copiloto.jsx`):
- Varre `main.main` por `input, textarea, select` visíveis e habilitados.
- Para cada campo monta `{ idx, label, type, value, required, options? }`.
- `label` é resolvido por estrutura: `label[for]` → `aria-label` → `<label>` ancestral → `placeholder`.

**Preenchimento** (`vpcApplyFills` + `vpcSetValue`):
- Os inputs são **controlados pelo React**; setar `el.value` direto não atualiza o estado.
- Por isso usamos o **setter nativo do prototype + disparo de `input`/`change`**, que o React capta.
- Selects casam por `value` ou texto da opção. Campo preenchido recebe um flash amarelo (`.vpc-flash`).

**Revisão** (`analyze`): envia também `documentText` = `innerText` do `main` (até 12k chars).

---

## Contrato da Edge Function `vp-copiloto`

`POST https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/vp-copiloto`
(Authorization: `Bearer <ANON_KEY>`)

**Request**
```json
{
  "mode": "chat | fill | analyze",
  "message": "texto do usuário",
  "history": [{ "role": "user|assistant", "content": "..." }],
  "page": {
    "route": "contrato-venda-equipamentos",
    "title": "Contrato Venda de Equipamentos",
    "fields": [{ "idx": 0, "label": "CNPJ", "type": "text", "value": "", "required": true }]
  },
  "documentText": "(apenas no modo analyze)"
}
```

**Response**
```json
{
  "reply": "1 a 3 frases — sempre presente",
  "fills":     [{ "idx": 0, "label": "CNPJ", "value": "12.345.678/0001-90" }],
  "questions": [{ "id": "cnpj", "text": "Qual o CNPJ do contratante?" }],
  "issues":    [{ "severity": "alta|media|baixa", "where": "...", "problem": "...", "suggestion": "..." }]
}
```

Só vêm as chaves relevantes ao modo. `reply` é sempre obrigatório.

---

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `src/vp-copiloto.jsx` | Bolinha + painel + scanner + preenchedor (cliente). |
| `styles/vp-copiloto.css` | Estilo (tema VP), prefixo `vpc-`. |
| `supabase/functions/vp-copiloto/index.ts` | Edge Function (IA Anthropic). |
| `src/app.jsx` | Monta `<VpCopiloto/>` em todas as rotas, **exceto** `ficha-tecnica`. |
| `index.html` | Carrega o CSS e o script. |

> Na **Ficha Técnica**, quem responde é o especialista de NCM/DUIMP (`FtCopiloto`,
> `src/ficha-tecnica-copiloto.jsx`) — por isso a bolinha global se esconde lá, para
> não haver dois assistentes. Podem ser unificados no futuro.

---

## Segredos (Supabase → Edge Functions)

- `ANTHROPIC_API_KEY` — chave Anthropic (já configurada; compartilhada com `ncm-duimp-assist`).

---

## Como estender

- **Novo campo/tela**: nada a fazer — o scanner é genérico.
- **Mudar o modelo**: `MODEL` em `supabase/functions/vp-copiloto/index.ts` (ex.: `claude-opus-4-8` p/ máxima precisão).
- **Ajustar comportamento/persona**: constante `SYSTEM` na mesma Edge Function.
- **Ações novas (ex.: navegar, salvar)**: estender o contrato de resposta com um campo de ação
  e tratá-lo em `send()` no cliente.
