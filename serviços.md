# Serviços transversais do VP Gestão — documento de trabalho (rascunho para o Claude VPS, 01/11/2026)

> **Status: RASCUNHO de trabalho, não é documento oficial.** Este arquivo fica na **raiz** do repositório só para que o Claude da VPS e o Claude do repositório se comuniquem pelo GitHub. Quando o Gelson aprovar o conteúdo, ele é movido para `docs/servicos/` (ou para a pasta de módulos, conforme o Gelson decidir). Até lá, **não escrever nada em `docs/modulos/`**.
>
> **Por que o GitHub:** o Claude da VPS e o Claude do repositório não têm outro canal direto. O acordo é: o Claude da VPS **edita este arquivo** e envia o resultado pelo GitHub; o Claude do repositório **lê de volta**, confere o que foi escrito e, se for preciso, corrige. Depois que o conteúdo estiver pronto, o arquivo é movido para a pasta de documentos.
>
> **Quem escreveu esta versão:** o Claude do repositório, a partir de (a) os documentos dos 14 módulos já aprovados (`docs/modulos/`), (b) o `CLAUDE.md`, (c) a lista de Edge Functions e crons conferida no banco em 01/11/2026. **Não li o código da VPS** e não tenho acesso a ela. Tudo que vem da VPS está marcado como **Herdado** (relato de outra sessão) ou **Não verificado**.

## Pedido ao Claude da VPS (leia antes de editar)

Você vai **criar a estrutura completa** deste documento de serviços, com o mesmo modelo dos 14 módulos. Você conhece melhor do que ninguém os serviços que rodam na VPS. Regras:

1. **Mantenha o modelo.** Use a mesma estrutura de cabeçalho, Índice, Glossário, numeração e Parte comum dos módulos aprovados (ver "Modelo a manter" abaixo). Não invente um formato novo.
2. **Selos de verificação em toda afirmação relevante** (Art. 6 da Constituição): **Conferido** (você leu no código ou na configuração da VPS, com data), **Herdado** (veio de outro documento ou de relato) ou **Não verificado**. Sem selo vale como Não verificado.
3. **Não invente.** Número, nome de arquivo, versão, contagem, horário e data só entram se você viu. Se não encontrou, escreva "não encontrei".
4. **Nenhum segredo nem dado pessoal** (Art. 28): sem telefone, e-mail pessoal, token, chave, senha, nome de conta bancária. Se um arquivo da VPS tiver isso, descreva o que ele faz sem copiar o valor.
5. **Não altere código, configuração, banco nem serviço** a partir deste documento. A tarefa é só escrever o documento. Se achar algo errado no serviço, **registre como "achado, sem correção"** (Art. 45).
6. **Divergência entre documento e código** (Art. 12): não escolha uma versão. Registre a divergência e deixe a pergunta para o Gelson.
7. **Inbox:** você conhece pouco o Inbox. Não o documente em profundidade. Use só a seção "Inbox (referência)" para descrever a ligação dele com os serviços que você conhece, e aponte para o documento do módulo (1.5).
8. **Telegram:** o Gelson quer um serviço de Telegram com estrutura igual à destes serviços. **Hoje não há nenhuma menção a Telegram no repositório.** Descreva o que você souber do Telegram na VPS; o que não souber, deixe como "Não verificado". Não crie funções de Telegram que não existem.
9. **Ao terminar**, deixe no próprio arquivo, no topo, uma nota de histórico: data, o que mudou e o que ficou pendente. Não cole o conteúdo inteiro numa mensagem; o arquivo é a fonte.

## O que este documento deve cobrir

Serviços transversais: usados por vários módulos, por isso não pertencem a um só módulo (ver `CLAUDE.md`, "Serviços transversais").

| Nº | Serviço | Estado do que sabemos |
|---|---|---|
| S1 | WhatsApp (envio e resposta) | Parcial; Edge Functions conferidas no repositório |
| S2 | gi-avisos (serviço de avisos na VPS) | Herdado; regras num arquivo do repositório |
| S3 | Copiloto VP (chat e geração de texto) | Parcial; Edge Function conferida |
| S4 | Telegram | **Não há nada no repositório.** Levantar |
| S5 | Integração com o vpsistema (login, pessoas, alçadas, avisos) | Parcial |

O **Inbox** não é um serviço S: é um módulo (`01_geral.md`, 1.5). Ele aparece aqui só como **canal de entrada e saída** que usa alguns destes serviços.

Numeração: S1 a S5. Se o Claude da VPS achar que a ordem deve mudar, escreva a proposta no topo, não renumere sozinho (Art. 43 vale por analogia).

## Fatos conhecidos (ponto de partida — confirme ou corrija)

Estes fatos vêm dos documentos do repositório e foram conferidos no banco em 01/11/2026 quando indicado. Use como ponto de partida, **não como verdade final**.

**S1 — WhatsApp**
- Edge Function `whatsapp-notify` (versão 10, em produção, `verify_jwt: true`). Código no repositório: `supabase/functions/whatsapp-notify/index.ts`. **Conferido** que existe; **não li** o corpo.
- Edge Function `decisao-resposta-whatsapp` (versão 1, em produção, `verify_jwt: false`). É o caminho de volta: recebe a resposta da pessoa. Usada pelo aval do montador, que a Juliana responde por WhatsApp. **Conferido** que existe; **não li** o corpo. Como `verify_jwt` é false, a validação da resposta precisa estar dentro dela. **Não verificado.**
- Alertas do sistema (tabela `alertas`) são a origem de boa parte dos avisos. Um aviso com destinatário é entregue pelo gi-avisos (S2). Eventos de fluxo saem pela `eventos_outbox`, publicada por um cron a cada minuto (`eventos-publicar-outbox`). **Conferido** que o cron existe.
- Ao montador, o WhatsApp vem do cadastro da empresa (`parceiros_instaladores`). **Herdado.**

**S2 — gi-avisos**
- Serviço na VPS que entrega os avisos da tabela `alertas` por WhatsApp. **Herdado** (relato da sessão da VPS, 24/10/2026).
- Regras de comportamento que foram relatadas (confira na VPS, não aceite de cara):
  - agrupa avisos parecidos em 24 horas pela chave do título, que ignora números, acentos e pontuação (por isso os títulos trazem o dia da semana por extenso);
  - não entrega avisos cujo título ou texto contenha "teste", "claude", "playwright" ou "excluir";
  - reescreve o texto a partir dos primeiros 400 caracteres do título e do subtítulo;
  - respeita janelas por departamento (por exemplo, Engenharia de segunda a sexta, 07h às 18h) e bloqueio em feriados marcados como `bloqueia_envio`;
  - o log de entrega fica no vpsistema (`eventos.entregas_externas`) e, na VPS, no log de estado do serviço. **Não verificado** os caminhos exatos.
- As regras do serviço estão em `.claude/gi-avisos-regras-whatsapp.md`, **única cópia**. Não excluir. **Conferido** que existe.
- Decisão do Gelson (24/10/2026): **não mexer no gi-avisos**; reabrir só se um aviso chegar ilegível (`CLAUDE.md`, memória do projeto).

**S3 — Copiloto VP**
- Edge Function `vp-copiloto` (versão 36, em produção, `verify_jwt: true`). **Conferido.**
- Conhecimento de cada tela na tabela `vp_copiloto_docs`, que tem prioridade sobre o texto embutido na função. Ajustar uma tela é UPDATE, sem redeploy. **Herdado** (`CLAUDE.md`, 10/10/2026).
- Existe também um Copiloto na VPS, em `copiloto.vpsistema.com`, rota `/perguntar`, somente leitura, com limite de 20 perguntas por hora por pessoa. **Herdado.** Dúvida que o Claude da VPS deve responder: a Edge Function fala com esse serviço, ou são duas coisas? **Não verificado.**
- A geração de descrição técnica (inglês e chinês) de produtos chama o Copiloto da VPS com `mode: 'chat'` e `novaConversa: true`, o que reinicia a conversa de quem pediu. **Herdado** (`CLAUDE.md`, 25/10/2026). Pendência: um modo da VPS sem memória.

**S4 — Telegram**
- **Nenhuma referência no repositório** (conferido em 01/11/2026). Tudo deve ser levantado na VPS: se existe, o que envia, para quem, com que credencial (sem copiar a credencial), e como se encaixa com o gi-avisos e o WhatsApp.

**S5 — vpsistema**
- Login único pelo vpsistema.com; o VP Gestão recebe o token e troca por sessão nativa pela Edge Function `sso-exchange` (versão 5, `verify_jwt: false`). **Conferido** que existe.
- Cadastro de pessoas e alçadas vem do vpsistema pela função `vpsistema-sync` (versão 8, `verify_jwt: false`). A tabela `colaboradores_vpsistema` tem 51 linhas e `alcadas_capacidade` tem 1.834. **Conferido** (01/11/2026).
- **Mensagens:** o vpsistema também está integrado ao envio de mensagens (WhatsApp e avisos). Não sabemos ainda se o vpsistema envia direto ou se passa pelo gi-avisos. **Não verificado.** Esta é uma das perguntas mais importantes para o Claude da VPS responder.
- O telefone do usuário no vpsistema (`profiles.celular`) é a fonte do número usado pelo gi-avisos. **Herdado.** Não copiar números.

**Inbox (referência; não é S)**
- Caixa `suporte@vpsistema.com`, envio pela `send-email` (versão 24), leitura pela `read-inbox` (versão 17, cron a cada 10 minutos). **Conferido.**
- Regras permanentes e área blindada: `docs/modulos/01_geral.md`, 1.5. Não editar a partir deste documento.

## Modelo a manter

O documento segue o mesmo molde dos 14 módulos. Estrutura obrigatória:

1. **Cabeçalho de status e de "por que este serviço pede cuidado"** (três pontos de atenção, no máximo).
2. **Fonte da verdade e selos** (Conferido / Herdado / Não verificado, com a data).
3. **Escopo** (o que o serviço faz e o que não faz; o que pertence a outro documento).
4. **"Como esta numeração funciona"** (remete aos temas, sem repetir a regra).
5. **Índice** (serviços S1 a S5 e a Parte comum PC-1 a PC-12).
6. **Glossário** (só os termos deste conjunto de serviços; termos gerais ficam em `01_geral.md`).
7. **Um bloco por serviço (S1, S2, S3, S4, S5)** com os temas: **x.1 O que é · x.2 Onde está (arquivos, funções, serviço na VPS) · x.3 Quem usa (telas e módulos) · x.4 Como entra e sai (mensagens, formatos, filas) · x.5 Regras e janelas · x.6 Dados (tabelas e logs) · x.7 Segurança (quem pode ver, que segredos existem, sem valores) · x.8 Falhas e como se percebe · x.9 Testes · x.10 Pendências e achados (sem correção) · x.11 Histórico**.
8. **Parte comum (PC-1 a PC-12)**, com o mesmo sentido dos módulos: mapa de ligações entre serviços, fluxo de uma mensagem de ponta a ponta, rotas e páginas públicas, segurança e segredos, quem faz o quê, Edge Functions e crons, tabelas, testes, tutoriais, documentos concatenados e benefícios trocados com os módulos.
9. **Um quadro de "Achados, sem correção"** no fim, com o que parecer defeito.

Regra de ouro (Art. 44): **uma regra em um lugar só.** Se a regra de um serviço já está num módulo, aponte para o módulo, não copie.

## Pendências para o Gelson (o Claude da VPS não decide)

- Qual é o recorte exato do WhatsApp (canal, funções, aval por WhatsApp).
- Se o vpsistema envia mensagens direto ou pelo gi-avisos.
- O que é o Telegram e se ele entra no plano agora.
- Se o Copiloto da VPS e a `vp-copiloto` são o mesmo serviço.
- Quando o documento sai daqui e vai para `docs/servicos/`.

## Índice deste rascunho

- Pedido ao Claude da VPS
- O que este documento deve cobrir
- Fatos conhecidos (ponto de partida)
- Modelo a manter
- Pendências para o Gelson

## Glossário (rascunho)

- **gi-avisos:** serviço da VPS que entrega avisos da tabela `alertas` pelo WhatsApp.
- **Alerta:** linha da tabela `alertas`; quando tem destinatário, vira aviso a ser entregue.
- **Outbox (`eventos_outbox`):** fila de eventos publicada por cron; alimenta a Linha do Tempo e alguns avisos.
- **Copiloto VP:** assistente de texto e de consulta, com duas partes (Edge Function e serviço na VPS).
- **Telegram:** canal ainda não identificado no repositório.
- **Selo:** Conferido, Herdado ou Não verificado (Art. 6).

---

**Histórico deste rascunho**
- 01/11/2026: criado pelo Claude do repositório, a partir dos módulos aprovados, do `CLAUDE.md` e de contagens conferidas no banco. Sem leitura de código da VPS. Pendente: o Claude da VPS completar as seções S1 a S5 e a Parte comum, e responder às perguntas da seção "Pendências".
