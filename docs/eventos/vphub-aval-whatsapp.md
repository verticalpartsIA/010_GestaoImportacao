# Aval do CEO (Diego) por WhatsApp — como funciona e o que falta ligar (atualizado 21/10/2026)

## Como os avisos saem de verdade
O hub NÃO usa as regras da Central (`eventos.regras`, modo **sombra** = só simula). O envio real é do **gi-avisos**, que lê os eventos
`hub.aviso_fluxo` e entrega por WhatsApp (conferido em `eventos.entregas_externas`: "WhatsApp enviado"). Por isso todos os avisos novos
nascem como linha em `alertas` com `destinatario_email` (o trigger `trg_evt_aviso_alerta` cria o `hub.aviso_fluxo`) ou como
`hub.aviso_fluxo` direto (`_ci_aviso`). **Não** use `instalador.aval_pendente`/`instalador.aval_respondido` (camada simulada).

## Fluxo (tudo no banco, `20261021100000_aval_ceo_disparo_automatico.sql`)
1. "Enviar" no rascunho do Contrato Instalador = **pedir o aval**: `ci_pedir_envio` grava o WhatsApp do montador (contrato continua rascunho); a decisão
   `contratacao_mao_obra_ceo` nasce (papel `ceo_diego`, só o Diego) e `_aval_enfileirar_pendente` cria o aviso ao Diego com a pergunta
   "…Você autoriza? Responda SIM ou NÃO".
2. **SIM** (WhatsApp via `decisao_whatsapp_responder`, ou botão Aprovar na Central de Decisões): o gatilho `trg_aval_resultado` chama `_ci_disparar`:
   contrato vira `enviado` (validade 7 dias), nascem as 3 assinaturas internas (Diego, Juliana, Maurício) **todas liberadas ao mesmo tempo** e cada uma recebe
   o aviso de assinatura; **quem pediu** recebe o link do montador pronto para encaminhar (o montador é externo e a Central ainda não aceita destinatário por telefone).
3. **NÃO**: nada é enviado; o Maurício recebe o aviso para falar com o Diego. O aval pode ser reenviado (`decisao_aval_reenviar`, reabre a decisão).
4. O Maurício também é avisado do SIM.
5. **Trava no servidor**: `public_ci_assinar`/`public_ci_visualizado` recusam contrato em `rascunho` sem aval aprovado (`aguardando_aval`), mesmo com o link.
6. O contrato só fica COMPLETO (`assinaturas_completas_em`) com o montador + as 3 internas, em qualquer ordem (`_ci_verificar_completo`).

## O que falta (fora deste repositório)
1. **Ler o "SIM/NÃO" do Diego**: alguém precisa chamar a Edge Function `decisao-resposta-whatsapp` quando chegar mensagem do número do Diego (Evolution → webhook,
   ou o próprio gi-avisos, que já trata comandos como "pausar").
   ```
   POST https://jxtqwzmpgofwctqajewt.supabase.co/functions/v1/decisao-resposta-whatsapp
   X-Timestamp: <segundos>   X-Assinatura: sha256=<HMAC-SHA256 hex de "<timestamp>.<corpo>", chave = EVENTOS_SEGREDO>
   { "telefone": "5511994621946", "texto": "Sim", "mensagem_ref": "M009" }
   ```
   Resposta `200 { ok, resultado, resposta }`: enviar `resposta` de volta ao Diego. `numero_desconhecido` → não responder nada.
   Enquanto isso não existir, o Diego aprova pela Central de Decisões (mesmo efeito).
2. **Montador (externo) automático**: o gi-avisos/Central só entregam a quem tem e-mail cadastrado no vpsistema. Para sair sozinho ao montador seria preciso aceitar
   um telefone no próprio aviso (`destinatarios[].telefone`) — hoje o link do montador vai para quem pediu encaminhar.
3. Conferir com o gi-avisos como ele monta o texto do aviso de assinatura quando `assinou_antes` vem vazio (ordem livre).
