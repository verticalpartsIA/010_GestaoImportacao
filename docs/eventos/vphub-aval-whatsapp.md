# Aval do CEO (Diego) por WhatsApp — o que falta ligar na Central de Eventos (vpsistema)

Lado do HUB (já pronto): decisão `contratacao_mao_obra_ceo` só do Diego; função SQL `decisao_whatsapp_responder`; Edge Function
`decisao-resposta-whatsapp`; botão "Reenviar pedido de aval" no envio do Contrato Instalador.
Lado da Central (**fora deste repositório — precisa ser feito no vpsistema**): 3 coisas.

## 1. Catálogo da origem `vphub`: um tipo novo e um texto novo
| Tipo | Quando sai | Destinatário | Texto |
|---|---|---|---|
| `instalador.aval_pendente` (já existe) | Pedido de aval ao Diego (criação **e reenvio**) | Diego, `payload.destinatarios[0].telefone` | **`{{mensagem}}`** (o HUB já manda o texto pronto: "Diego, a obra X precisa do seu aval para a contratação do montador Y (contrato Z), valor R$ W. Você autoriza? Responda SIM ou NÃO.") |
| `instalador.aval_respondido` (**novo**) | O Diego respondeu SIM ou NÃO | Maurício, `payload.destinatarios[0].telefone` | **`{{mensagem}}`** (já vem escrita: "O Diego APROVOU…" / "O Diego RECUSOU… Fale com o Diego…") |

Campos do `payload` de `instalador.aval_respondido`: `resultado` (`aprovada`|`reprovada`), `mensagem`, `obra`, `instalador`, `contrato`, `codigo`, `valor_fmt`, `respondido_por`, `destinatarios`.
Números cadastrados no HUB (tabela `decisao_whatsapp_numeros`): Diego 55 11 99462-1946 (aprovador), Maurício 55 11 91622-0666 (ciente).

## 2. Encaminhar a resposta do Diego ao HUB (a parte que lê o "SIM"/"NÃO")
Quando a Evolution API receber uma mensagem **do número do Diego**, a Central deve chamar:

```
POST https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/decisao-resposta-whatsapp
Content-Type: application/json
X-Timestamp:  <segundos desde 1970>
X-Assinatura: sha256=<HMAC-SHA256 em hex de "<timestamp>.<corpo>", chave = EVENTOS_SEGREDO (a mesma da origem vphub)>
apikey / Authorization: Bearer <chave publicável do projeto vpprd>   (a função não exige JWT; o que vale é a assinatura)

{ "telefone": "5511994621946", "texto": "Sim", "mensagem_ref": "M009" }   // mensagem_ref opcional (código do contrato)
```
Resposta `200`: `{ ok, resultado, resposta }` — **enviar `resposta` de volta ao Diego** no WhatsApp ("✅ Aval registrado…").
`erro`: `ambiguo` (há mais de um aval aberto — `resposta` já pede "responda SIM M009"), `resposta_invalida`, `nada_pendente`, `ja_decidida`.
`numero_desconhecido` → **não responder nada** (não confirmar a ninguém que não seja o aprovador).
Se a Evolution entregar "resposta citando a mensagem" (quoted), basta mandar o código do contrato em `mensagem_ref`; sem isso, com um único aval aberto o "SIM" simples já vale.

## 3. Conferir
- Fila: `select tipo, status, ultimo_erro from eventos_outbox where tipo like 'instalador.aval%' order by id desc;`
- `tipo_nao_cadastrado_na_central` → falta cadastrar `instalador.aval_respondido` (passo 1).
- Teste sem WhatsApp: `curl` assinado na função (ver o esquema de `eventos-publicar`, no sentido inverso).
