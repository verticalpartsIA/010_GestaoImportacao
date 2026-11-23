# Troca do motor de e-mail: SMTP/IMAP (suporte@vpsistema.com) → Microsoft Graph (hub@verticalparts.com.br)

> Área blindada do Inbox (Constituição Art. 15). Cada etapa de mudança em produção exige "Confirmo" do Gelson (Art. 14).
> Selos (Art. 6): **Conferido** (com data e como) · **Não verificado**.

## 1. Specify — o que muda e o que NÃO muda

**Muda (só o transporte):** `send-email` e `read-inbox` deixam de falar SMTP/IMAP da Hostinger e passam a falar com a Microsoft Graph, usando a caixa `hub@verticalparts.com.br`.
**Não muda:** tela do Inbox, tabela `emails_projeto`, vínculo por cotação, triagem, alertas, soft-delete, contrato de entrada/saída das duas funções (o front não é alterado).
**Fora do escopo:** apagar mensagem na caixa da Microsoft (a exclusão continua sendo só `excluido_em` no sistema); nome da pessoa no "De" (precisa de uma fonte de nome — hoje o "De" é "VerticalParts"); anexos maiores que 2,5 MB.

## 2. Estado conferido (09/11/2026)

- Segredos `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `SENDER_EMAIL` no Supabase; login na Microsoft aceito; app com só `Mail.ReadWrite` e `Mail.Send`. **Conferido** (função `graph-email-teste`, 08–09/11/2026).
- `hub@verticalparts.com.br`: acesso à caixa de entrada = 200. **Conferido.** `contato@verticalparts.com.br` também responde 200 → **a política de acesso (Application Access Policy) ainda NÃO foi aplicada**; o app alcança caixas que não deveria. **Pendente com o TI.**
- `send-email-next` enviou e-mail real do `hub@` para o Gmail de teste e obteve o `internetMessageId` (a Graph não deixa escolher o Message-ID; o id vem do rascunho). **Conferido** (09/11/2026).
- `read-inbox-next` (modo `simular`) abre a caixa do `hub@` e lê as mensagens: total 0 (caixa nova). **Conferido.** Vínculo por resposta (`In-Reply-To` = `internetMessageId` que o site gravou): **Não verificado** — depende da resposta do Gmail.

## 3. Decisões assumidas (a confirmar)

1. Remetente: `hub@`, nome de exibição "VerticalParts"; respostas voltam para o `hub@` (Reply-To padrão).
2. Excluir: só no sistema, nunca na caixa da Microsoft.
3. `suporte@vpsistema.com`: continua rodando em paralelo (leitura IMAP antiga) até o Gelson mandar desligar.
4. Chave de idempotência da leitura: coluna `imap_uid` (texto) recebe `g:<id imutável da Graph>`; sem migration.

## 4. Plano

- **Etapa 2 (FEITA em 09/11/2026, sem tocar produção):** `send-email-next`, `read-inbox-next`. **Conferido:** envio do `hub@` ao Gmail de teste; resposta lida e vinculada (`certo`); acentos e anexo com nome acentuado chegaram íntegros (confirmado pelo Gelson no Gmail). Achado e corrigido nas cópias: o Storage recusa nome de arquivo com acento (`InvalidKey`) — o caminho agora usa nome ASCII e o nome original fica em `filename`. **O mesmo defeito existe no `send-email`/`read-inbox` de produção** (anexo com nome acentuado não é guardado). **Não verificado:** leitura de e-mail com anexo recebido (a caixa só tinha respostas sem anexo) e e-mail recebido de fornecedor real.
- **Etapa 3 (só com novo "Confirmo"):** apontar o front para as funções novas (ou substituir o conteúdo de `send-email`/`read-inbox` depois de testar com cópia), trocar o cron `read-inbox-poll`, manter `suporte@` em paralelo. Pré-requisito de segurança: política de acesso aplicada.

## 5. Tasks / riscos

- Resposta de fornecedor que vai para `suporte@` antigo deixa de aparecer se a leitura IMAP for desligada.
- Texto simples das mensagens recebidas é derivado do HTML (a Graph devolve um corpo só); a "Extrair preço" do Inbox lê o texto — conferir com e-mail real de fornecedor.
- Limite de envio da Graph (por caixa) é maior que o das travas atuais (25/60 envios por 10 min).
- Após o teste: apagar `graph-email-teste`, `send-email-next`, `read-inbox-next` e as linhas de teste de `emails_projeto` (referência `TESTE-CLAUDE-GRAPH`).

## 6. Etapa 3 — FEITA em 09/11/2026 (com "Confirmo" do Gelson)

- **Publicado em produção:** `send-email` v30 (Microsoft Graph, remetente `hub@`, assinatura corporativa) e `read-inbox` v23 (lê `hub@` pela Graph e `suporte@vpsistema.com` por IMAP, juntando numa lista; `LEITURA_SUPORTE=off` desliga o suporte@). **Conferido:** teste de envio pelo caminho de produção ao Gmail do Gelson, com anexo de nome acentuado — `ok:true`, linha gravada em `emails_projeto` (`de_email = hub@`, `message_id` da Microsoft); leitura simulada de produção: `hub` ok (0 mensagens), `suporte` ok.
- **Versão anterior (SMTP/IMAP):** Git, commit `b40b53e`, arquivos `supabase/functions/send-email/index.ts` e `read-inbox/index.ts`. Antes de publicar, o código de produção foi comparado com o repositório (303 e 469 linhas, mesmas marcações).
- **Assinatura:** banner (imagem no bucket `engenharia`, `email-assinatura/assinatura-hub.jpg`, sem a marca BST) + texto de reserva, acrescentada pelo `send-email`; o corpo gravado em `emails_projeto` é o original. Desligar: secret `ASSINATURA_HUB=off`. **Conferido** no Gmail (Gelson, 09/11/2026). **Não verificado:** Outlook/celular; e-mail enviado de dentro de uma tela (proposta, RFQ, tratativa).
- **Não verificado:** a primeira execução do cron `read-inbox-poll` depois da troca; leitura de e-mail recebido com anexo e de fornecedor real no `hub@`.
- **Limpeza FEITA em 09/11/2026 (Confirmo + CONFIRMO_DESTRUTIVO do Gelson):** funções `graph-email-teste`, `send-email-next`, `read-inbox-next` apagadas no Supabase e as pastas removidas do repositório; 5 linhas de teste `TESTE-CLAUDE-GRAPH*` apagadas de `emails_projeto` (anexos de teste ficam no bucket `emails-anexos`, pasta `saida/`).
- **Pendente:** política de acesso do TI (app só alcançar o `hub@`) e troca do segredo que teve trechos expostos; desligar o `suporte@` quando o Gelson mandar.
