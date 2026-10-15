# Avisos de WhatsApp do Contrato/Pagamento de Instaladores — como ligar na Central de Eventos

O VP HUB (origem `vphub`) **publica o fato**; a Central (`vpsistema.com/eventos`) decide para quem e como avisar.
Lado do HUB: fila `eventos_outbox` + função `eventos-publicar` (cron a cada minuto). Se a Central estiver fora do ar, o evento fica na fila e é reenviado (1, 5, 15, 60 min).

## 1. Cadastrar 3 tipos de evento no catálogo da origem `vphub` (na Central)
| Tipo | Quando sai | Campos do `payload` |
|---|---|---|
| `instalador.aval_pendente` | Contrato do instalador pede o aval do CEO (Diego) antes do envio | `obra`, `quantidade_elevadores`, `valor`, `valor_fmt`, `instalador`, `contrato`, `cotacao` |
| `instalador.contrato_assinado` | O instalador assinou o contrato | `obra`, `quantidade_elevadores`, `valor`, `valor_fmt`, `instalador`, `contrato`, `dossies`, `assinante` |
| `instalador.recibo_assinado` | O montador assinou o recibo de pagamento | `recibo`, `instalador`, `dossie`, `tipo`, `valor`, `valor_fmt`, `data_pagamento`, `assinante` |

Modo sugerido: começar em `sombra` (a Central registra e simula, sem enviar) e passar para `ativo` depois de conferir.

## 2. Regras (destinatários) e textos sugeridos
- **instalador.aval_pendente → Diego** (CEO):
  `📋 Aval pendente — contrato de instalação. Obra: {{obra}}. Elevadores: {{quantidade_elevadores}}. Preço: {{valor_fmt}}. Instalador: {{instalador}}. Abra o VP Gestão › Central de Decisões para aprovar.`
- **instalador.contrato_assinado → Maurício (11 91622-0666), Felipe (11 97526-9475), Gustavo (61 99676-1820), Cleiton Domingos (11 96264-6124)**:
  `✅ Contrato assinado: {{contrato}} — {{instalador}}. Obra: {{obra}}. Elevadores: {{quantidade_elevadores}}. Valor: {{valor_fmt}}.`
- **instalador.recibo_assinado → Felipe** (e quem o Financeiro quiser):
  `🧾 Recibo {{recibo}} assinado por {{assinante}} ({{instalador}}) — {{valor_fmt}} em {{data_pagamento}}.`

Gustavo e Cleiton não têm perfil no HUB: cadastre-os como destinatários externos (`tipo = externo`) na Central.

## 3. Segredo da origem
A função usa a variável **`EVENTOS_SEGREDO`** (o segredo HMAC da origem `vphub`, o mesmo cadastrado na Central). Sem ela a função não envia nada e a fila fica intacta. Variáveis opcionais: `EVENTOS_ORIGEM` (padrão `vphub`), `EVENTOS_INGEST_URL`.

## 4. Como conferir
- Fila do HUB: `select tipo, status, tentativas, ultimo_erro from eventos_outbox order by id desc;`
  - `tipo_nao_cadastrado_na_central` → falta o passo 1. `assinatura_ou_origem_recusada` → segredo errado. `falha` → esgotou 5 tentativas (para reenviar: `update eventos_outbox set status='pendente', tentativas=0, proximo_em=now() where id=…`).
- Na Central: tela `/eventos` (aba de eventos/envios).
