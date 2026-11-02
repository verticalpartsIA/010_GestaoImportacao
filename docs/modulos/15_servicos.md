# 15 Serviços — Central de Avisos (WhatsApp, gi-avisos, Copiloto, Telegram, vpsistema, E-mail) — REAL, fonte da verdade (01/11/2026)

> **Nota de histórico (pedido do rascunho, item 9)**
> - **01/11/2026 — Claude do repositório:** criou o rascunho `serviços.md` na raiz (S1 a S5, fatos de partida, modelo a manter).
> - **01/11/2026 — Claude da VPS (esta versão):** por ordem do Gelson, o rascunho **mudou-se para `docs/modulos/15_servicos.md`** e virou o compilado de **todos os serviços de aviso e mensagem do hub, inclusive o que existe no vpsistema.com** (a "central de avisos"). Conferi o código e a configuração da VPS (gi-avisos, Copiloto, ponte do Telegram, Evolution), o banco do hub e do vpsistema (só SELECT) e os ~40 documentos do repositório que falam de gi-avisos, WhatsApp, Telegram e Inbox. Acrescentei o **S6 E-mail (canal do Inbox)**, por decisão do Gelson (canal aqui, tela e lei no 1.5). Corrigi seis fatos do rascunho que o código desmente (ver "Fatos do rascunho corrigidos", no fim).
> - **01/11/2026 — aprovado pelo Gelson.** Respostas dele registradas em "Decisões do Gelson" (abaixo). No mesmo dia: lido o repositório privado `17_gente-gestao` (autorizado), o que corrigiu S1.2, S1.4 e S1.5 e revelou que **ninguém chama a função do aval por WhatsApp** (achado A19); restaurados na lista "quem recebe" (S2.5) os nomes que o texto antigo do Geral trazia. A troca das origens por ponteiros, as doações aos módulos e a emenda do apontamento no `CLAUDE.md` vão no PR seguinte.
> - **02/11/2026 — fechamento da parte documental (Claude da VPS).** Pedido do Gelson: "se encontrar algo fora desse contexto crie issues […] no documento deve constar os achados e números das issues além dos links". Cada achado do quadro ganhou **uma issue** (#1312 a #1339) com o link ao lado. As decisões de 02/11 (aval por WhatsApp, Copiloto lendo `vp_copiloto_docs`) foram registradas, e a parte **operacional** (publicar e testar) ficou para a próxima fase, também em issues. Duas correções conferidas neste dia: o repositório **010 está privado** (o "repositório público" dos A2 e A18 estava errado; o do vpsistema é que é público) e o **A16 foi confirmado** (a Evolution é alcançável pela internet, sem criptografia).
> - **Ficou pendente:** só decisões e operação, todas com issue (quadro de achados).

> **Status: REAL (documento oficial dos serviços), aprovado pelo Gelson em 01/11/2026.** Mora em `docs/modulos/` **por ordem explícita do Gelson**; o Art. 41 do `CLAUDE.md` passa a apontar para cá (emenda pedida por ele no mesmo dia). Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que estes serviços pedem cuidado:** (1) **uma linha na tabela `alertas` com destinatário vira WhatsApp** para uma pessoa real, e essa tabela **aceita escrita pela chave pública** (PC-4); (2) **tudo o que a VPS manda por WhatsApp sai por uma só instância e um só número** (`pv360`): se ela cair, param juntos os avisos do hub, o Copiloto no WhatsApp, as cobranças do VP Click e a ferramenta de WhatsApp do Claude (S1); (3) **existem dois "despachantes" de WhatsApp e só um envia**: a Central de Eventos do vpsistema mostra regras "ativas" que nunca enviaram nada; quem envia de verdade é o gi-avisos na VPS (S2, S5).
>
> **Fonte da verdade e selos:** o código e a configuração da VPS (`/root/gi-avisos`, `/root/copiloto-claude`, `/root/telegram-claude`, container `evolution-api`), o banco do hub (`jxtqwzmpgofwctqajewt`) e do vpsistema (`ubdkoqxfwcraftesgmbw`), só leitura, e o repositório em `origin/main` `ae64ebf`, tudo em **01/11/2026**. **Conferido** = lido no código/configuração ou consultado no banco nesta data (com o "como"); **Herdado** = veio de outro documento ou da memória de sessões anteriores e **não** foi reconferido; **Não verificado** = não consegui confirmar. Sem selo vale como Não verificado (Art. 6). **Nenhum telefone, e-mail pessoal, chave, token ou senha** foi copiado (Art. 28): onde existem, cito só o nome da variável ou o arquivo.
>
> **Escopo:** os serviços que **levam ou trazem mensagens** para as pessoas do hub (hub.vpsistema.com) e do vpsistema.com: S1 WhatsApp (canal Evolution), S2 gi-avisos, S3 Copiloto VP, S4 Telegram, S5 vpsistema (login, pessoas, alçadas, Central de Eventos e mensagens próprias) e S6 E-mail (canal do Inbox). **Não são deste documento:** a **regra de negócio** de cada aviso (quem aprova o quê, quando um prazo vence) — mora no módulo que cria o aviso, e aqui só se aponta; a **tela** Inbox e a sua **lei blindada** (`01_geral.md` 1.5); a tela Notificações (1.2) e a Central de Decisões (1.3); os sistemas vizinhos que usam o mesmo número de WhatsApp (pv360/Verti, VP Click, Escamax, VPRequisições), descritos só como vizinhos em PC-10.
>
> **Já documentado em outro lugar (não se repete, aponta):** `alertas` como barramento, rota padrão e expiração em `01_geral.md` PC-4 e 1.2; o aval do montador por WhatsApp em `11_parceiros_instaladores.md` e `01_geral.md` 1.3; segurança real (#571), inventário completo de Edge Functions e crons em `14_administracao.md` PC-4, PC-6 e PC-7; a lei do e-mail em `01_geral.md` 1.5 e no `CLAUDE.md` ("ÁREA BLINDADA — Sistema de E-mail / Inbox").

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) mora uma vez só em `docs/modulos/01_geral.md`. Aqui o "módulo" é **15** e cada serviço é um **S** (S1 a S6), no lugar das telas. A ordem S1–S5 veio do rascunho; o **S6** foi acrescentado no fim para não renumerar (Art. 43). Proposta de nova ordem, se houver, entra aqui no topo, não se renumera sozinho.
- Cada serviço tem os mesmos temas: **x.1 O que é · x.2 Onde está · x.3 Quem usa · x.4 Como entra e sai · x.5 Regras e janelas · x.6 Dados · x.7 Segurança · x.8 Falhas e como se percebe · x.9 Testes · x.10 Pendências e achados · x.11 Histórico**.
- O que vale para todos fica na **Parte comum** (PC-1 a PC-12), sem número de serviço. Mudou algo? Escreva no tema certo e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
15. **Serviços — Central de Avisos**
   S1 WhatsApp (canal Evolution) · S2 gi-avisos (avisos do fluxo) · S3 Copiloto VP · S4 Telegram · S5 vpsistema (login, pessoas, alçadas, Central de Eventos, mensagens próprias) · S6 E-mail (canal do Inbox)
   &nbsp;&nbsp;&nbsp;Cada serviço: x.1 O que é · x.2 Onde está · x.3 Quem usa · x.4 Como entra e sai · x.5 Regras e janelas · x.6 Dados · x.7 Segurança · x.8 Falhas e como se percebe · x.9 Testes · x.10 Pendências e achados · x.11 Histórico
   Parte comum (sem número de serviço)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 Um aviso de ponta a ponta · PC-3 Endereços e páginas públicas · PC-4 Segurança e segredos · PC-5 Quem faz o quê · PC-6 Edge Functions e crons · PC-7 Tabelas · PC-8 Testes · PC-9 Tutoriais e menu "?" · PC-10 Vizinhos que usam o mesmo número · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os módulos
   Quadro de achados, com issue · Pendências para o Gelson · Fatos do rascunho corrigidos

## Glossário (serviços)
Termos gerais (alerta, alerta global/dirigido, alçada, evento de fluxo, caixa compartilhada) estão em `01_geral.md`. Não se repetem aqui.
- **Aviso:** mensagem que chega a uma pessoa (WhatsApp, Telegram ou e-mail). No hub quase sempre nasce de uma linha de `alertas` ou de uma etapa/evento do fluxo.
- **Evolution (Evolution API):** programa na VPS que conecta um número de WhatsApp e envia/recebe mensagens. É só o "cano"; quem decide o que dizer são os serviços.
- **Instância `pv360`:** a conexão do número de WhatsApp oficial dentro da Evolution, usada por todos os serviços da VPS (o nome vem do Pós-Venda 360, o primeiro a usá-la).
- **gi-avisos:** serviço Node.js na VPS que lê os avisos do hub na Central de Eventos e os entrega por WhatsApp, redigidos pelo Claude.
- **`hub.aviso_fluxo`:** tipo de evento com que o hub publica **todos** os seus avisos na Central de Eventos do vpsistema.
- **Fila de saída (`eventos_outbox`):** tabela do hub onde os avisos esperam ser publicados na Central; um cron a esvazia a cada minuto.
- **Central de Eventos:** esquema `eventos` e tela `vpsistema.com/eventos` do vpsistema: recebe eventos dos sistemas, guarda regras, destinatários, pausas e o registro de entregas.
- **Sombra / legado / ativo:** modo de um gatilho na Central. **Sombra** = calcula o envio mas só o marca como `simulado`; **legado** = o próprio sistema de origem envia; **ativo** = a Central envia. Em 01/11/2026 **nenhum** gatilho está ativo.
- **Entrega externa (`eventos.entregas_externas`):** registro, no vpsistema, de cada decisão do gi-avisos por destinatário (enviado, agrupado, na fila, pausado, encerrado, sem número, autor, sem regra, previsto, erro).
- **Agrupamento (24 h):** avisos parecidos para a mesma pessoa saem uma vez por dia; os demais ficam "agrupado".
- **Janela de envio (`janela.json`):** horário em que o gi-avisos pode mandar WhatsApp; fora dela o aviso espera.
- **Pausa:** pedido da pessoa (em `vpsistema.com/eventos/destinatarios`) para não receber WhatsApp, total ou por assunto.
- **Redator:** parte do gi-avisos que pede ao Claude (Haiku 4.5, pela assinatura) para reescrever os fatos em linguagem de colega.
- **Montador externo:** pessoa fora da empresa (instalador contratado) que recebe por telefone, sem e-mail, com texto fixo e link de assinatura.
- **Aval por WhatsApp:** resposta SIM/NÃO a uma decisão, mandada pelo WhatsApp e gravada na decisão pelo hub (regra de negócio no módulo 11; mecânica no S1).
- **Copiloto da VPS:** sessão Claude em `copiloto.vpsistema.com` que responde no hub (bolinha), na Ficha Técnica (NCM e "Preencher a ficha") e no WhatsApp.
- **`vp-copiloto` (Edge Function):** versão antiga do Copiloto, que chamava a API da Anthropic; **removida em 01/11/2026** (não tinha chamador no front).
- **Ponte do Telegram:** serviço da VPS que liga o bot do Telegram a uma sessão Claude, para Gelson e Diego.
- **HMAC:** assinatura de uma mensagem entre sistemas, feita com um segredo combinado, que prova quem mandou e que nada foi alterado.
- **SSO:** login único: a pessoa entra no vpsistema.com e o hub aceita esse login.

---

## S1 WhatsApp (canal Evolution)

### S1.1 O que é
O **canal** por onde saem e chegam as mensagens de WhatsApp dos sistemas da VerticalParts: um número oficial conectado à **Evolution API**, que roda na VPS. Não decide nada sozinho: quem decide o que mandar é o serviço que chama (gi-avisos, Copiloto, VP Click, vpsistema). **Conferido** (01/11/2026, `docker ps`, `fetchInstances`).

**Fora do escopo:** o **atalho manual** `wa.me` (o botão que abre o WhatsApp da pessoa com o texto pronto) usado em CRM, Cotações, Proposta, Contrato, Vistoria e recibos: é ação humana, sem automação nem registro, e fica em cada módulo (`02_crm.md`, `04`, `06`, `07`, `09`, `11`). **Herdado.**

### S1.2 Onde está
- **Evolution:** container `evolution-api` na VPS, com `evolution-postgres` e `evolution-redis`. Instâncias: **`pv360`** (conectada) e `posvenda360` (desconectada desde 01/06/2026). **Conferido** (01/11/2026).
- **No hub (Edge Functions):** `decisao-resposta-whatsapp` (v1, `verify_jwt: false`) recebe a resposta SIM/NÃO; `whatsapp-notify` (v10) **foi removida em 01/11/2026** (não tinha chamador). **Conferido** (listagem e código, 30/10 e 01/11/2026).
- **No vpsistema:** `_shared/whatsapp.ts` (envio direto pela Evolution) e as funções do Gente & Gestão implantadas no projeto do vpsistema: `whatsapp-dispatcher` (v17, `verify_jwt: false`), `whatsapp-send` (v13) e `whatsapp-start` (v13), com código no repositório privado `17_gente-gestao`; `evolution-webhook-admin` (v14) e `admissao-portal` (v11, pública) estão implantadas **sem pasta** naquele repositório (achado A21). **Conferido** (listagem e leitura do `17_gente-gestao`, commit `d1aa134`, 01/11/2026); a comparação byte a byte do implantado com o repositório **não foi possível**.

### S1.3 Quem usa
Todos pela instância `pv360` (**Conferido**, 01/11/2026):

| Serviço | Sistema | O que manda |
|---|---|---|
| gi-avisos (S2) | hub | avisos do fluxo, assinaturas, cobranças |
| Copiloto da VPS (S3) | hub/vpsistema | respostas a colaboradores que perguntam pelo WhatsApp |
| vpclick-cobranca | VP Click | menções, conclusões, atrasadas, inatividade (PC-10) |
| ferramenta de WhatsApp do Claude (`whatsapp-mcp`) | ferramenta | envio sob comando de uma sessão Claude |

O vpsistema manda as **suas** mensagens (código de login, recuperação de senha, comunicados) pela Evolution com secrets próprios (S5); qual instância ele usa: **Não verificado**.

### S1.4 Como entra e sai
- **Saída:** `POST /message/sendText/<instância>` na Evolution. **Conferido** (gi-avisos `envio.js`; vpsistema `_shared/whatsapp.ts`).
- **Entrada:** a instância `pv360` entrega cada mensagem recebida (`MESSAGES_UPSERT`) ao `whatsapp-dispatcher` do vpsistema, que confere o cabeçalho `apikey` (secret `EVOLUTION_APIKEY`). **Conferido** (consulta do webhook e código, 01/11/2026). Ordem de decisão do dispatcher (**Conferido** no `17_gente-gestao`):
  1. evento que não é mensagem, sem remetente ou de grupo → repassa ao Pós-Venda 360 (Verti);
  2. **toda mensagem recebida vai primeiro ao Copiloto** (`/whatsapp`, com `{telefone, msg_id}`, espera de 12 s); se o Copiloto reconhece um colaborador ativo e responde, para aqui;
  3. senão consulta `contratacao_whatsapp_routing`: setor `rh` → só grava a mensagem para o RH; setor `posvenda` → repassa ao Pós-Venda; "menu"/"0" com setor já escolhido reinicia o menu; 24 h sem mensagem ou ticket do Pós-Venda concluído também reiniciam;
  4. número desconhecido recebe o menu "*1* Vagas (RH) / *2* Suporte"; 3 respostas não entendidas → Pós-Venda; qualquer erro → Pós-Venda.
  **O dispatcher não chama a `decisao-resposta-whatsapp`** (ver S1.5 e achado A19).
- **Volta do aval (hub):** `decisao-resposta-whatsapp` recebe `{telefone, texto, mensagem_ref?}` assinado por HMAC (`X-Timestamp`, `X-Assinatura`, segredo `EVENTOS_SEGREDO`) e chama `decisao_whatsapp_responder`. **Conferido** (código).

### S1.5 Regras e janelas
- O hub **não** chama a Evolution diretamente: o envio dos avisos do hub é do gi-avisos (S2). **Conferido** (código e migrations da fila, 01/11/2026).
- **Aval por WhatsApp** (`decisao-resposta-whatsapp`): comparação de assinatura em tempo constante; janela de 5 minutos; sem segredo responde 503; telefone até 30 e texto até 200 caracteres; só aceita número com papel `aprovador` ativo em `decisao_whatsapp_numeros` (compara os últimos 11 dígitos); com vários avais abertos exige o código do contrato; decisão já tomada não muda; número desconhecido não recebe resposta. **Conferido** (código). **Quem aprova** é regra do módulo 11 (hoje a Juliana; o Maurício recebe como ciente — `01_geral.md` 1.3, **Herdado** de consulta de 31/10/2026).
- **Hoje o aval por WhatsApp não chega à decisão (achado A19):** nenhum sistema chama a `decisao-resposta-whatsapp` (procurado no `17_gente-gestao`, no Copiloto e no gi-avisos; a função é de 20/10/2026 e o dispatcher foi publicado em 17/10). Um "SIM"/"NÃO" mandado por WhatsApp por um colaborador cai no Copiloto como pergunta comum. **A aprovação real acontece pela Central de Decisões (1.3).** **Conferido** (código, 01/11/2026).
- As janelas de horário e o agrupamento são do gi-avisos (S2.5), não do canal.

### S1.6 Dados
- Hub: `decisao_whatsapp_numeros` (**3** linhas; só o servidor lê), `whatsapp_notification_log` (**4** linhas, todas de 15/10/2026 ou antes, de quando a `whatsapp-notify` foi testada; nenhuma migration do repositório cria esta tabela). **Conferido** (01/11/2026, `count(*)` e busca nas migrations).
- Telefones: três fontes convivem — `profiles.celular` do vpsistema (oficial), `perfis.whatsapp_number` do hub (cópia, preenchida pelo `vpsistema-sync`) e `decisao_whatsapp_numeros` (só o aval). **Conferido.**

### S1.7 Segurança
- Secrets por nome: gi-avisos `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_APIKEY`; vpsistema `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`; `whatsapp-notify` busca as credenciais no cofre do vpsistema (`VPSISTEMA_DB_URL`); `decisao-resposta-whatsapp` usa `EVENTOS_SEGREDO`. **Conferido** (nomes).
- **A mesma chave da Evolution é lida por mais de um serviço:** o Copiloto lê a do arquivo de configuração do gi-avisos. Trocar a configuração de um quebra o outro (achado A7).

### S1.8 Falhas e como se percebe
- Se a instância `pv360` desconectar, **todos** os envios da VPS param ao mesmo tempo (achado A3). O gi-avisos tenta até 5 vezes por aviso e então avisa o Gelson pelo Telegram (S2.8); os demais serviços: ver PC-10.
- A `whatsapp-notify`, se fosse chamada, gravaria em `whatsapp_notification_log`; os 4 registros são de testes antigos (`skipped_no_apikey`, `skipped_no_number`, `error`). **Conferido.**

### S1.9 Testes
Não há teste automatizado do canal (**Conferido**, busca no repositório). O teste e2e usa Supabase simulado e nunca envia. Cenário: **Dado** um aviso com destinatário no horário da janela, **quando** o gi-avisos varre, **então** a mensagem sai pela instância `pv360` e a Central registra `enviado`.

### S1.10 Pendências e achados
- **Achado, sem correção (A1):** `whatsapp-notify` está no ar sem trava de quem chama e sem limite de taxa, embora ninguém a chame; já registrada como risco na auditoria (`AUDITORIA_FORENSE_E2E_SCORE.md`, E2E-006). Decidir: remover (com pasta em `supabase/functions-removidas/`, Art. 23) ou manter. **Conferido** (código).
- **Achado, sem correção (A2, [#1312](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1312)):** o repositório (**privado**, conferido em 02/11/2026) tem telefones de pessoas em `supabase/migrations/20261020120000_aval_ceo_whatsapp.sql`, `20261022190000_aval_instalador_juliana.sql`, no comentário de `supabase/functions/decisao-resposta-whatsapp/index.ts` e em `docs/eventos/vphub-instalador.md` (valores não copiados; Art. 28). O comentário da função ainda diz que quem responde é o Diego; a regra atual é a Juliana (módulo 11).
- **Achado, sem correção (A3):** um só número e uma só instância para todos os serviços; a instância de reserva `posvenda360` está desconectada.
- **Achado (A19, [#1329](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1329)):** ninguém chama `decisao-resposta-whatsapp`; o aval por WhatsApp não decide nada (S1.5). **Decisão do Gelson (02/11/2026): ligar.** Mudança pronta no `17_gente-gestao`, [PR #62](https://github.com/verticalpartsIA/17_gente-gestao/pull/62), **não publicada**: o `whatsapp-dispatcher` manda ao hub, antes do Copiloto, a mensagem que é só SIM/NÃO (com ou sem código), assinada com o segredo da origem `vphub`. Publicar e testar é da fase operacional.
- **Achado, sem correção (A20):** no RH, conversa aberta pelo `whatsapp-start` não grava a hora da última mensagem; quando o candidato responde, o dispatcher acha a conversa "fria" (24 h) e devolve o menu em vez de gravar para o RH. Contatos no formato `@lid` não seriam reconhecidos. Mídia vira "[mídia]". 31 das 37 conversas pararam no menu; nenhuma mensagem de RH desde 07/08/2026. **Conferido** (código e SELECT no vpsistema).
- **Achado, sem correção (A22):** se o Copiloto demorar mais de 12 s para aceitar uma mensagem, o dispatcher segue para o menu/Pós-Venda e a pessoa pode receber duas respostas.

### S1.11 Histórico
Desenho de 17/09/2026 com `whatsapp-notify` não foi adotado; desde 16/10/2026 o hub publica tudo na Central e o gi-avisos envia; aval por WhatsApp desde 20/10/2026, passado à Juliana em 22/10/2026. **Herdado** (`01_geral.md`, migrations).

---

## S2 gi-avisos (avisos do fluxo do hub)

### S2.1 O que é
O serviço que **avisa por WhatsApp quem precisa agir na próxima etapa** do fluxo do hub (Formulário, Precificação, Proposta, Contrato, Avais, Assinaturas, ART, cobranças diárias). Lê os avisos que o hub publica na Central de Eventos, decide quem recebe, respeita janela, feriado, pausa e agrupamento, pede ao Claude o texto e envia pela Evolution. **Conferido** (código, 01/11/2026).

**Fora do escopo:** quem deve receber cada aviso **de negócio** (essa lista está em S2.5 só como ela está no código; a decisão é do módulo dono); o RFQ ao fornecedor (vai por e-mail/`wa.me`, **não** passa pelo gi-avisos, **Conferido**).

### S2.2 Onde está
- Pasta `/root/gi-avisos` na VPS; serviço systemd `gi-avisos` (`node index.js`, reinício automático, fuso de São Paulo); **repositório git local, sem cópia no GitHub**. **Conferido** (`systemctl cat`, `git remote -v` vazio).
- Arquivos: `index.js` (ciclo, janela, feriados, fila), `fontes_central.js` (leitura da Central, regras de etapa e de montador), `fontes.js` (leitura antiga direto do hub, usada só se `modo.json` pedir), `pessoas.js` (destinatários e telefones), `redator.js` (texto pelo Claude), `envio.js` (Evolution e alerta pelo Telegram), `janela.json` (horário e feriados), `modo.json` (`{"fonte":"central"}`), pasta `state/` (log e estado). **Conferido.**
- **Regras escritas** do serviço: `.claude/gi-avisos-regras-whatsapp.md` neste repositório (24/10/2026, "única cópia", não excluir). Comparação regra a regra com o código em S2.10. **Conferido.**

### S2.3 Quem usa
Todos os módulos que geram aviso com destinatário: Comercial (4), Financeiro (5), Contratos (6), Engenharia (8), Obras (9: Evolução dos Equipamentos e ART), Parceiros (11: assinaturas, lembretes, distrato), Logística/Fabricação (12/13: crons de alerta) e o Inbox (respostas de fornecedor). A lista de crons que gravam `alertas` está em PC-6. **Conferido** (crons) / **Herdado** (quais módulos).

### S2.4 Como entra e sai
- **Entrada:** a função `eventos.giavisos_ler_hub(desde)` do vpsistema devolve os eventos `hub.aviso_fluxo`; o hub os publica a partir de cinco origens: `alertas`, `eventos_fluxo`, `gatilhos` (etapas), resposta de fornecedor e assinaturas. **Conferido** (`fontes_central.js`; migrations da fila no hub).
- **Gatilho da varredura:** Realtime em 8 tabelas do hub (`eventos_fluxo`, `gatilhos`, `decisoes_gerenciais`, `cotacoes_elevador_fornecedor`, `precificacoes_elevador`, `propostas`, `contratos_venda_equipamentos`, `emails_projeto`) dispara uma varredura 2 s depois; além disso, varredura fixa a cada 60 s; cada uma relê desde a última menos 10 minutos. Na primeira subida marca os últimos 120 dias como já vistos. **Conferido** (`index.js`).
- **Leituras extras no hub, mesmo no modo Central:** `perfis`, `formularios_elevador` e `propostas` (vendedor e cotação), `alertas.resolved` (para não mandar aviso já resolvido) e `calendario_feriados` (feriados). **Conferido.**
- **Saída:** WhatsApp pela Evolution (`envio.js`, até 2 tentativas por chamada, 3 s entre mensagens) e o registro de cada decisão em `eventos.entregas_externas` pela função `eventos.giavisos_registrar_entrega` (papel de banco próprio do gi-avisos no vpsistema). **Conferido.**

### S2.5 Regras e janelas
Tudo **Conferido** no código em 01/11/2026, salvo marca.
- **Destinatário e telefone:** o telefone vem primeiro do vpsistema (`profiles.celular`) e, se faltar, de `perfis.whatsapp_number` do hub; cache de 10 minutos; divergência entre os dois vai ao log com o número mascarado. Montador externo: telefone que vem no próprio aviso.
- **Quem recebe (como está no código, tabela `ETAPAS` e líderes fixos em `pessoas.js`):** Formulário preenchido → Comercial (a Regiane segue com a precificação; o Guilherme e a ADM do Comercial acompanham); fornecedor respondeu → quem enviou a cotação ao fornecedor (senão o dono da cotação) + Financeiro; Precificação nasceu → Financeiro + ADM; Precificação vencida/escalonada → Financeiro e CEO; Precificação concluída → vendedor, Regiane (libera o envio) e ADM; Proposta enviada/reenviada, lead e cliente cadastrado → ADM do Comercial; "cotação enviada ao fornecedor" → ninguém. A ADM do Comercial (Victoria, desde 23/10/2026) **só acompanha**: sem cobrança e nada depois da proposta. Os líderes por área (financeiro, jurídico/importação, engenharia, ADM) estão **fixos no código**. A regra de negócio de cada linha é do módulo dono (4 e 5).
- **Autor não recebe o próprio aviso** — só quando o aviso traz o autor (eventos de fluxo e precificação).
- **Valores (R$):** só CEO, Financeiro e Gelson veem valores (`VEEM_VALORES`); no texto dos alertas o R$ do `detalhe` vira `[valor]`. Ver achado A9 (título não é mascarado).
- **Palavras bloqueadas:** aviso cujo título ou texto tenha "teste", "playwright", "claude" ou "excluir" **não sai** (na leitura da Central; a leitura antiga não bloqueava "excluir").
- **Agrupamento de 24 h:** avisos vindos de `alertas` com o mesmo título normalizado (sem números, acentos e pontuação, 60 caracteres) **mais** o Nº da cotação saem uma vez por pessoa a cada 24 h; resposta de fornecedor agrupa por cotação + fornecedor. **Nunca agrupam:** decisões (`decisao_tipo`) e avisos do Contrato do Instalador (`ci-envio-`, `ci-assinado-`, `ci-lembrete-`). O mesmo evento nunca sai duas vezes para a mesma pessoa (chave = `idempotency_key` + destinatário, guardada 90 dias). **Consequência para quem cria aviso:** como os números são apagados da chave, uma data numérica não separa dois avisos; o título precisa do **dia da semana por extenso**, da obra ou do código do contrato (regra aplicada nos módulos 9 e 11).
- **Texto:** o redator chama o Claude Haiku 4.5 pela assinatura, numa pasta isolada com todas as ferramentas negadas, em lotes de 12; se falhar, usa um texto-modelo. O `detalhe` vai com no máximo 400 caracteres. O link de assinatura é colado fora do texto da IA.
- **Janela de envio (`janela.json`, relido a cada varredura):** padrão **segunda a sexta, 07:00–18:00** (Brasília); única exceção: **Juliana nos avisos de Precificação, 09:30–17:30**. **Não existe janela por departamento.** Fora da janela o aviso vai para a fila (`na_fila`); se for resolvido no hub antes de sair, **não sai** (vale só para avisos de `alertas`). `"ativa": false` desliga as janelas; arquivo ausente ou inválido volta ao padrão. Prazo (SLA) e janela de envio são calendários separados.
- **Feriados:** **lidos da tabela `calendario_feriados` do hub** (`ativo` e `bloqueia_envio`; 39 datas que bloqueiam, de 2026 a 2028), no máximo a cada 60 s, com espera de 8 s; se a leitura falhar, usa a lista do `janela.json` (Guarulhos/SP). O interruptor `feriados_hub.ativo` está **ligado** desde 24/10/2026. **Conferido** (código, `janela.json` e `count(*)`).
- **Pausas:** lidas a cada 60 s de `eventos.giavisos_pausas()`; cada pessoa pausa em `vpsistema.com/eventos/destinatarios` (tudo ou por assunto); **pedido de assinatura nunca é pausado**.
- **Assinaturas em sequência:** Contratado → CEO → Testemunhas; cada um recebe o link na sua vez.
- **Montador externo:** destinatário **sem e-mail e com telefone**, e só para o papel **"Contratado"**; texto fixo, sem IA, com o link `https://hub.vpsistema.com/assinar/...`; prefixo "Lembrete: " quando o aviso é lembrete; telefone de 10–11 dígitos ganha o 55, com menos de 12 dígitos não sai; o registro fica só no log local (a Central exige e-mail).
- **Decisão do Gelson (24/10/2026): não mexer no gi-avisos**; reabrir só se um aviso chegar ilegível. **Herdado** (rascunho `serviços.md` e `01_geral.md` PC-4).

### S2.6 Dados
- **VPS, pasta `state/`:** `log.jsonl` (442 linhas de 07/10 a 30/10/2026), `estado.json` (847 chaves de "já enviado", apagadas após 90 dias), `fila.json` (2 avisos esperando a janela), `etapas_abertas.json` (9 etapas acompanhadas), `comparacao.jsonl` (parado desde 16/10, da fase de comparação). **Conferido.**
- **vpsistema:** `eventos.entregas_externas` (**964** linhas de 16/10 a 01/11/2026: enviado 340, sem regra 301, agrupado 185, na fila 65, pausado 31, previsto 22, encerrado 19, autor 1). **Conferido** (SQL).
- **Hub:** só lê (S2.4). Os dados que geram aviso estão em PC-7.

### S2.7 Segurança
- Roda como **root** na VPS (a unidade não define usuário). **Conferido.**
- Secrets por nome: `SUPABASE_URL` e `SUPABASE_KEY` (chave **pública** do hub), `EVOLUTION_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_APIKEY`, `VPSISTEMA_PG_URL` (papel próprio no vpsistema), `CLAUDE_MODEL`, `DRY_RUN` (falso); `ANTHROPIC_API_KEY` existe mas o redator usa a assinatura e a retira do processo filho. **Conferido** (nomes).
- **Credenciais emprestadas de outros serviços:** a senha de leitura do banco do hub vem do arquivo de configuração do Copiloto; o bot do Telegram vem do arquivo do Borderô (achado A7).

### S2.8 Falhas e como se percebe
- Falha de envio: o aviso volta à fila até 5 vezes; depois, **alerta ao Gelson pelo Telegram**, no máximo 1 por hora. **Conferido.**
- Erros de conexão com o banco ("terminating connection") apareceram em 31/10 e 01/11/2026; não perdem aviso (a varredura não avança), mas disparam o alerta do Telegram. Em 29/10/2026 a leitura de feriados alternou entre sucesso e espera esgotada. **Conferido** (`journalctl`).
- Onde olhar: `journalctl -u gi-avisos`, `state/log.jsonl`, e a tela `vpsistema.com/eventos` (entregas). **Conferido.**

### S2.9 Testes
**Não existe** teste automatizado do gi-avisos (**Conferido**: a pasta não tem testes). Existe `DRY_RUN` (hoje desligado). Cenários: **Dado** um alerta dirigido criado num sábado, **quando** o gi-avisos varre, **então** ele fica `na_fila` e sai na segunda às 07:00. **Dado** dois alertas com o mesmo título normalizado e a mesma cotação no mesmo dia, **então** o segundo fica `agrupado`. **Dado** um aviso com "teste" no título, **então** nada sai.

### S2.10 Pendências e achados
Regras escritas (`.claude/gi-avisos-regras-whatsapp.md`) comparadas com o código em 01/11/2026 (**Conferido**):

| Regra escrita | Código |
|---|---|
| Lê só de `hub.aviso_fluxo` | Em parte: a origem é a Central, mas também lê o hub direto (S2.4) |
| Feriados: a lista do `janela.json` é o lugar único; leitura do hub **desligada** | **Contradiz:** a tabela do hub vale e o interruptor está ligado desde 24/10; a lista local é reserva |
| Pendência "falta o hub alinhar `calendario_feriados`" | **Desatualizada:** a coluna `bloqueia_envio` e a leitura pública existem e o log mostra 39 datas lidas |
| Resolvido no hub enquanto espera → não sai | Só para avisos de `alertas`; etapas e eventos não passam por essa conferência |
| Autor não recebe o próprio aviso | Só quando o aviso traz o autor |
| Agrupamento | Confirma; o código agrupa também a resposta de fornecedor, que a regra não cita |
| Montador: destinatário marcado `externo:true` | **Diverge:** o código não olha `externo`; usa "sem e-mail + com telefone" e só o papel "Contratado" |
| Demais regras (janela, Juliana, quem recebe, Victoria, valores, `ci-*`, chave de idempotência, assinaturas, pausas, sem exceção de horário para o aval) | Confirmam |

- **Achado, sem correção (A8):** pessoa **inativa** pode receber aviso: a busca do celular no vpsistema não filtra ativos e o caminho de reserva não confere `perfis.ativo`. Hoje sem efeito (todos os 48 perfis do vpsistema estão ativos).
- **Achado, sem correção (A9):** o **título** do aviso não tem o R$ mascarado (só o `detalhe`); se um módulo puser valor no título, ele chega a quem não deveria ver valores.
- **Achado, sem correção:** o README do gi-avisos diz que ele lê o hub e é "só leitura"; hoje lê a Central e grava no vpsistema.
- **Divergência (Art. 12):** os textos de `CLAUDE.md` (seção "Evolução dos Equipamentos") e `01_geral.md` PC-4 dizem que o gi-avisos "entrega a tabela `alertas`" e que há "janela por departamento (Engenharia 07–18)". O código mostra o caminho via Central (PC-2) e a janela padrão para todos. **Pergunta ao Gelson:** atualizo os dois textos no PR de ponteiros?
- Pendências herdadas das regras: `clientes.criado_por` vazio faz o aviso "Cliente cadastrado" sair sem o vendedor; exceções de horário para aval do CEO e assinaturas em avaliação não existem (decisão em aberto). **Herdado.**

### S2.11 Histórico
Versão inicial em 22/10/2026 (decisões deixam de agrupar); 23/10 montador por telefone, avisos `ci-*` sem agrupamento, Victoria, janela da Precificação; 24/10 feriados de Guarulhos, feriados do hub preparados e **ligados**. Antes de 16/10 o serviço lia o hub direto (fase "hub"). **Conferido** (`git log` local).

---

## S3 Copiloto VP

### S3.1 O que é
O assistente de texto e consulta do hub. São **duas peças diferentes** — e só uma está em uso:
- **Copiloto da VPS** (em uso): sessão Claude em `copiloto.vpsistema.com`, só leitura dos dados, respeitando alçadas. Responde na bolinha do hub, gera descrição com pesquisa na internet, classifica NCM/DUIMP e preenche a Ficha Técnica, e responde colaboradores no WhatsApp. **Conferido** (`servico.py`, 01/11/2026).
- **Edge Function `vp-copiloto`** (v36) — **removida em 01/11/2026**: era a versão antiga que chama a API da Anthropic (`claude-sonnet-5`, `ANTHROPIC_API_KEY`). **Nenhuma chamada a ela no front.** **Conferido** (código e busca em `src/`).

**Fora do escopo:** o conteúdo do que o Copiloto responde em cada tela (regra de cada módulo); `suggest-email-reply` (IA do Inbox, S6).

### S3.2 Onde está
- `/root/copiloto-claude/servico.py`, systemd `copiloto-claude`, ouvindo só em `127.0.0.1:8095`, publicado pelo nginx em `copiloto.vpsistema.com`. Rotas: `GET /saude`; `POST /perguntar` (modos `chat`, `fill`, `analyze`, `questionario`; o pesquisador entra quando a mensagem pede "pesquise este código"); `POST /ncm` (classificação NCM/DUIMP e `modo: "preencher"`); `POST /whatsapp`. **Conferido.**
- Base de conhecimento do NCM em `/root/copiloto-claude/conhecimento/ncm-*.md` e papel do "Preencher a ficha" em `ncm/preenchedor.md`. **Conferido.**
- Front que chama a VPS: `src/vp-copiloto.jsx` (bolinha), `src/cotacoes-varejo-store.js` (descrição com IA), `src/ficha-tecnica-copiloto.jsx` (NCM e Preencher). **Conferido.**

### S3.3 Quem usa
Todo usuário logado do hub (bolinha, com alçadas), Engenharia/Importação/Compras (Ficha Técnica), Cotações de Varejo (descrição técnica) e colaboradores pelo WhatsApp (estoque, "quando chega"). **Conferido** (chamadas no front e `perguntas.log`: 7 respostas pelo WhatsApp, a última em 21/10/2026).

### S3.4 Como entra e sai
- **Hub:** `Authorization: Bearer <token do login do hub>`; a VPS confere o token no Auth do **hub** (não do vpsistema), com cache de 5 minutos; origens aceitas `hub.vpsistema.com` e `vpprd.vpsistema.com`. **Conferido.**
- **WhatsApp:** o `whatsapp-dispatcher` do vpsistema manda **toda** mensagem recebida primeiro para cá, como `{telefone, msg_id}` em `/whatsapp` (S1.4); a VPS identifica a pessoa (`eventos.colaborador_por_telefone`), confere na Evolution que a mensagem existe, foi recebida desse número e tem até 10 minutos, e responde pela instância `pv360`. **Conferido.**
- **Modelos:** chat `claude-opus-4-8`; pesquisador e tarefas internas `claude-sonnet-5-5`; NCM e Preencher `claude-opus-5-5`; todos por `claude -p` com a ferramenta de dados do Copiloto, só leitura. **Conferido.**

### S3.5 Regras e janelas
- **20 perguntas por hora por pessoa** (janela móvel, guardada só em memória: zera se o serviço reiniciar); no máximo **3** perguntas ao mesmo tempo; conversa dura 2 h. NCM e Preencher contam na mesma cota. **Conferido.**
- Alçadas: lidas de `valores_acesso`, `alcadas_capacidade` e `colaboradores_vpsistema` no hub. **Conferido.**
- **"Preencher a ficha" só propõe;** a pessoa marca e aplica na tela. Nunca preenche Código Omie, SKU nem FCI; todo valor traz origem; sem origem vai para "faltando". **Conferido** (`ncm/preenchedor.md`).
- **Efeito colateral conhecido:** a descrição técnica com IA chama `/perguntar` com `mode: 'chat'` e `novaConversa: true`, o que **reinicia a conversa da bolinha** de quem pediu. **Herdado** (`CLAUDE.md`, 25/10/2026; `07_suprimentos_importacao.md`).
- **`vp_copiloto_docs` não é lida pelo Copiloto da VPS:** a regra "ajustar o texto de uma tela = UPDATE em `vp_copiloto_docs`, sem redeploy" (`CLAUDE.md` e módulos 4, 5, 6, 8, 10) valia **só para a Edge Function antiga**, removida em 01/11/2026. **Conferido** (busca no código da VPS, 01/11/2026). Ver divergência D1.

### S3.6 Dados
Lê (só leitura) o banco do hub pelo papel `copiloto_leitura` e o Omie pela ferramenta de leitura; registra perguntas em `perguntas.log` na VPS. A Edge Function antiga lê `vp_copiloto_docs`. **Conferido.**

### S3.7 Segurança
- Secrets por nome: senha do papel `copiloto_leitura` (arquivo de configuração do Copiloto); para o WhatsApp, a chave da Evolution e a conexão com o vpsistema são lidas **do arquivo do gi-avisos** (achado A7). **Conferido.**
- O nginx publica **todas** as rotas, inclusive `/whatsapp`; a proteção dessa rota é a conferência da mensagem na Evolution (S3.4). **Conferido.**
- A Edge Function antiga não tem trava de autenticação própria nem limite de taxa (risco de custo na API, se alguém a chamar). **Herdado** (levantamento do código, 01/11/2026).

### S3.8 Falhas e como se percebe
`GET /saude`; `journalctl -u copiloto-claude`; `perguntas.log`. Fila cheia responde 429 (no `/perguntar` a pergunta é contada mesmo assim, achado A10). **Conferido.**

### S3.9 Testes
Sem teste automatizado. Validações registradas: classificação NCM e "Preencher a ficha" testadas por chamada real (26/10/2026). **Herdado** (memória da sessão). Cenário: **Dado** um usuário logado que já fez 20 perguntas na última hora, **quando** pergunta de novo, **então** recebe o aviso de limite.

### S3.10 Pendências e achados
- **Achado, sem correção (A10):** em `/perguntar`, a fila cheia devolve 429 sem devolver a cota (o `/ncm` devolve); a cota vive só em memória.
- `vp-copiloto` **removida em 01/11/2026**. **Decisão do Gelson (02/11/2026), opção "a":** o Copiloto da VPS passa a ler `vp_copiloto_docs` (só a linha `rota:<rota>` da tela aberta). Pronto e testado na VPS, **não publicado** ([#1334](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1334)). Até a publicação, vale a divergência D1.
- Pendente desde 25/10/2026: um modo da VPS **sem memória** para a descrição com IA não apagar a conversa da bolinha. **Herdado.**

### S3.11 Histórico
Bolinha passou da Edge Function para a VPS em 11/10/2026; pesquisador na internet em 25/10; NCM/DUIMP na VPS e "Preencher a ficha" em 26/10/2026. **Herdado** (specs e memória).

---

## S4 Telegram

### S4.1 O que é
**Não há Telegram no hub nem no vpsistema** (nenhuma linha de código, migration ou documento no repositório além deste; nenhuma no código do vpsistema). **Conferido** (busca em 01/11/2026). O Telegram existe **só na VPS**, em três usos, todos com **o mesmo bot**:
1. **Ponte Telegram ↔ Claude** (`/root/telegram-claude`, systemd `telegram-claude`): Gelson e Diego conversam com uma sessão Claude (Omie e finanças). **Só responde; não manda aviso automático.**
2. **Borderô Financeiro diário** (`/root/bordero`): PDF por Telegram, cron `0 13 * * 1-5` UTC = **10:00 de Brasília**, para Gelson, Diego e Juliana.
3. **Alerta de falha** do gi-avisos e das cobranças do VP Click ao Gelson (no máximo 1 por hora).
**Conferido** (código, `crontab -l`, 01/11/2026).

**Fora do escopo:** usar o Telegram como canal de avisos do hub — não existe hoje e **nenhuma função de Telegram foi criada** (pedido do rascunho, item 8). Se o Gelson quiser, é trabalho novo (SDD).

### S4.2 Onde está
Ponte: `bridge.py` (long-poll em `getUpdates`, uma sessão Claude por chat, limite de 900 s por pergunta) e `audio.py` (voz local: Whisper "small" para ouvir e Piper `pt_BR-faber-medium` para falar; áudio até 10 minutos). Bot e chats autorizados vêm do arquivo de configuração do Borderô. **Conferido.**

### S4.3 Quem usa
Gelson e Diego (lista fixa de 2 chats; os demais só ficam registrados no log — 9 registros assim). Uso recente quase só do Diego; última pergunta em 01/11/2026. **Conferido** (`bridge.log`).

### S4.4 Como entra e sai
Texto e voz entram pelo bot; a ponte chama `claude -p --model claude-opus-4-8` e devolve texto (e voz, quando a pergunta veio em áudio). Comandos: `/start`, `/reset` e `/nova` (reiniciam a conversa). **Conferido.**

### S4.5 Regras e janelas
Sem janela de horário. A sessão é por chat e continua entre mensagens (`--resume`). **Conferido.**

### S4.6 Dados
Logs na pasta da ponte (`bridge.log`); o Borderô grava `cron.log`. Nada no banco. **Conferido.**

### S4.7 Segurança
- O token do bot fica num único arquivo de configuração (do Borderô) e é lido por quatro serviços (ponte, Borderô, gi-avisos, VP Click): trocar o token exige mexer em todos. **Conferido.**
- **Achado, sem correção (A11):** a ponte roda o Claude **sem trava de ferramentas** (permissão total); a restrição proposta em 26/10/2026 não foi aplicada. As instruções da pasta registram um webhook estranho em 20/09/2026 e recomendam avaliar a troca do token (pendente). **Conferido** (`bridge.py`).

### S4.8 Falhas e como se percebe
`journalctl -u telegram-claude`; `bridge.log`; para o Borderô, `cron.log` (últimas execuções terminaram bem de 27 a 30/10/2026). **Conferido.**

### S4.9 Testes
Sem teste automatizado. **Conferido.**

### S4.10 Pendências e achados
- **Achado, sem correção (A12):** o script e a mensagem de falha do Borderô dizem "06:00 BRT / 09 UTC"; o cron roda às 13:00 UTC (10:00 BRT).
- ~~Pergunta ao Gelson: o Telegram vira canal de avisos do hub?~~ **Respondida (01/11/2026): fica como está** (conversa + Borderô + alerta de falha).

### S4.11 Histórico
O antigo agente Hermes (Telegram) foi desligado em 10/06/2026 e substituído pela ponte Claude; os containers do Hermes **não existem mais** na VPS. **Conferido** (`docker ps -a`) / **Herdado** (data).

---

## S5 vpsistema (login, pessoas, alçadas, Central de Eventos e mensagens próprias)

### S5.1 O que é
O portal central (`vpsistema.com`, repositório público `verticalpartsIA/vpsistema`, projeto Supabase `ubdkoqxfwcraftesgmbw`) é **a fonte das pessoas** de todos os sistemas: login único, cadastro, celular, alçadas e valores. Para os avisos, tem três papéis: (1) **dá ao hub o login e as pessoas** (SSO e sincronização); (2) **guarda a Central de Eventos**, onde o hub publica os avisos e o gi-avisos registra as entregas; (3) **manda as suas próprias mensagens** (código de login, recuperação de senha, comunicados, convite por e-mail). **Conferido** (código e banco, 01/11/2026).

**Fora do escopo:** as telas de administração do vpsistema (pessoas, alçadas) além do que toca avisos; as funções do Gente & Gestão (repositório privado, não lido).

### S5.2 Onde está
- **No hub:** Edge Functions `sso-exchange` (v5, `verify_jwt: false`) e `vpsistema-sync` (v8, `verify_jwt: false`); `src/vp-auth.js`. **Conferido.**
- **Gente & Gestão (funções no projeto do vpsistema):** `whatsapp-dispatcher` (porta de entrada de todo WhatsApp recebido, S1.4), `whatsapp-send` e `whatsapp-start` (o RH conversa com candidato; só Administrador; só em conversa marcada como RH), tabelas `contratacao_whatsapp_routing` (37 linhas) e `contratacao_whatsapp_mensagens` (12). **Conferido** (01/11/2026).
- **No vpsistema:** 31 Edge Functions, entre elas `login-start` e `reset-start` (mandam WhatsApp e e-mail), `invite-user` (e-mail), `send-broadcast` (WhatsApp), `eventos-ingest` e `eventos-worker` (Central), `sso-proxy`; tela `/eventos` com abas para gatilhos, regras, destinatários, canais, fila, mensagens, falhas e auditoria. Documentação da Central no repositório do vpsistema: `docs/eventos/01` a `04`. **Conferido** (listagem e código).

### S5.3 Quem usa
Todas as pessoas (login), o hub (pessoas e alçadas), o gi-avisos (Central, telefones, pausas) e o Copiloto (telefone → pessoa no WhatsApp). **Conferido.**

### S5.4 Como entra e sai
- **Login (SSO):** a pessoa entra no vpsistema; o `sso-proxy` manda o token ao hub; o hub (`sso-exchange`) confere o token no Auth do vpsistema, exige `vp_email_ativo` e devolve uma sessão nativa (`vp-auth.js`). Limite: 60 por IP e 600 no total a cada 10 minutos (`api_rate_check`). **Conferido.**
- **Pessoas e alçadas:** o **vpsistema empurra** para o hub (`vpsistema-sync`, ações `set_alcadas`, `set_email`, `set_valores`, com o perfil junto); o hub não puxa. Disparos: na hora em que muda alçada, exceção de valor, substituição ou perfil; todo dia às 06:15 UTC; substituições às 03:05 UTC; conferência de falhas a cada 10 minutos. O telefone vai como `whatsapp` e cai em `perfis.whatsapp_number`. **Conferido** (migrations do vpsistema e código do hub).
- **Avisos do hub:** chegam à Central por `eventos-ingest` (assinados por HMAC, janela de 5 minutos, até 64 KB) — ver PC-2. **Conferido.**
- **Mensagens próprias do vpsistema** (não passam pela Central nem pelo gi-avisos): código de login (2FA) e recuperação de senha por WhatsApp; recuperação e convite por e-mail (SMTP da caixa `suporte@vpsistema.com`); comunicados agendados (`send-broadcast`, só para perfis ativos com celular; 2 disparos, ambos em 05/10/2026). **Conferido** (código e `scheduled_broadcasts`).

### S5.5 Regras e janelas
- **O celular oficial** de cada pessoa é `profiles.celular` no vpsistema (corporativo, senão pessoal, por gatilho no banco). Só pessoas `@verticalparts.com.br` são enviadas ao hub. **Conferido.** Regra de governança: o vpsistema é a **fonte única** de pessoas, ativo/inativo e celular. **Herdado** (decisão do Gelson, 08/10/2026).
- **A Central não envia os avisos do hub:** o gatilho `hub.aviso_fluxo` está em **sombra** e a sua regra está **inativa**; nenhum gatilho está em modo ativo; o `eventos-worker` roda a cada minuto **só se houver envio pendente** e **nunca enviou nada** (0 tentativas). **Conferido** (SQL, 01/11/2026).

### S5.6 Dados
**Conferido** (SQL, 01/11/2026):
- vpsistema, esquema `eventos`: 5 origens (hub 750 eventos, VPRequisições 313, outras 0); 3 canais (WhatsApp ativo, interno sem adaptador, e-mail inativo); 38 gatilhos; 1.063 eventos (`hub.aviso_fluxo` 743); 6 regras (5 ativas, a do hub inativa); 332 envios (323 simulados, 9 descartados sem contato); 0 tentativas; 45 destinatários (34 aptos ao WhatsApp); 9 assuntos de WhatsApp (só "assinaturas" não pausável); 964 entregas externas; auditoria imutável (109 linhas).
- vpsistema, pessoas: `profiles` 48 (todos ativos; 35 reais com celular, 4 sem, 9 cadastros-modelo); `user_grants` 2.101; `hub_sync_envios` 562; `hub_sync_falhas` 4 (13/10/2026).
- Hub: `colaboradores_vpsistema` 51; `alcadas_capacidade` 1.834; `perfis` 49 (39 ativos, 33 com `whatsapp_number`).

### S5.7 Segurança
- `vpsistema-sync` exige o cabeçalho `x-sync-secret`, conferido pelo próprio vpsistema (`verify_hub_sync_secret`); grava pela conexão interna do banco (`SUPABASE_DB_URL`). `sso-exchange` usa a chave pública do vpsistema (fixa no código, é pública por natureza). **Conferido.**
- O gi-avisos tem um papel de banco próprio no vpsistema, que só lê os avisos do hub e as pausas e só grava entregas. **Conferido** (migration `20261016160000` do vpsistema).
- **Achado, sem correção (A13):** o repositório público do vpsistema tem um segredo de reserva escrito no código de `sync-user-vprequisicoes` (função não implantada, mas o texto está no histórico do Git). Valor não copiado.

### S5.8 Falhas e como se percebe
`hub_sync_falhas` (vpsistema) e a conferência a cada 10 minutos; para os avisos, a tela `vpsistema.com/eventos` (mensagens, falhas e reenvios). **Conferido.**

### S5.9 Testes
No hub: `vp-auth.test.js` (modo de autenticação). Não há teste do `vpsistema-sync` nem da Central neste repositório. **Conferido.**

### S5.10 Pendências e achados
- **Achado, sem correção (A4):** dois despachantes, um parado: a tela `/eventos` mostra 5 regras "ativas" que nunca enviaram (gatilhos em sombra). Quem administra pode achar que a Central envia.
- **Achado, sem correção (A14):** as mensagens próprias do vpsistema (2FA, recuperação, comunicados) **não ficam registradas** na Central; o 2FA não deixa log de envio.
- **Achado, sem correção (A15):** o publicado e o repositório do vpsistema divergem: 9 funções no ar sem pasta no repositório (5 do Gente & Gestão, 3 de sincronização com satélites e `mcp-server`); `sync-user-vprequisicoes` no repositório e não implantada; `send-recovery-email` no repositório é um stub, a publicada é de julho (se ainda envia: **Não verificado**).
- **Achado, sem correção (A23) — os avisos `instalador.*` da Central nunca saíram:** o manual `docs/eventos/vphub-instalador.md` (15/10/2026) manda cadastrar na Central três tipos (`instalador.aval_pendente` → Diego; `instalador.contrato_assinado` → Maurício, Felipe, Gustavo e Cleiton; `instalador.recibo_assinado` → Felipe), começar em **sombra** e passar a **ativo** "depois de conferir". **Nunca passaram a ativo:** em 01/11/2026 os gatilhos seguem em sombra; `aval_pendente` teve 1 evento (16/10) e `contrato_assinado` 6 (até 23/10), com envios só `simulado`/`descartado`; `recibo_assinado` nunca teve evento. **O que chega de verdade** sai pelo gi-avisos como alertas do Contrato do Instalador: `ci-envio` (6), `ci-assinado` (9) e `ci-lembrete` (22, o último em 30/10), dirigidos a 3–4 pessoas internas. Consequências: (a) o aviso de contrato assinado chega ao **Cleiton, ao Maurício e ao Felipe** (função `_ci_efeitos`; 3 entregas `enviado` para cada um até 23/10) e **não** ao Gustavo — o que o Gelson confirmou como certo em 01/11/2026 *(correção: a primeira versão deste achado dizia, por engano, que o Cleiton não recebia; ele tem perfil ativo e recebe)*; (b) o aval já não é do Diego (é da Juliana, módulo 11) e o módulo 1 manda **não usar** `instalador.aval_pendente`; (c) há também ~24 alertas `ci-<código>` **sem destinatário** (avisos globais, de 15 a 23/10), que aparecem na tela mas não viram WhatsApp. **Conferido** (SELECT no hub e no vpsistema, 01/11/2026).
- **Achado, sem correção:** o espelho `colaboradores_vpsistema` do hub tem 51 pessoas ativas; o vpsistema tem 48 perfis.
- **Não verificado:** qual instância de WhatsApp o vpsistema usa nas mensagens próprias.

### S5.11 Histórico
Login único e alçadas concedidas no vpsistema desde 09/10/2026; Central de Eventos criada em 09/10/2026; o hub publica todos os avisos nela desde 15–16/10/2026. **Herdado/Conferido** (datas dos primeiros eventos no banco).

---

## S6 E-mail (canal do Inbox)

### S6.1 O que é
O **canal** de e-mail do hub: envio por SMTP e leitura por IMAP da caixa compartilhada `suporte@vpsistema.com`, com o registro de tudo em `emails_projeto`. A **tela** Inbox e a **lei blindada** do e-mail continuam em `01_geral.md` 1.5 e no `CLAUDE.md` ("ÁREA BLINDADA — Sistema de E-mail / Inbox"): **antes de mexer em qualquer coisa deste serviço, leia a lei de lá** (proibições: apagar e-mail da caixa, afrouxar as travas, reduzir o tempo ou apagar o cron, testar sem cópia). **Conferido** (código, 30/10–01/11/2026).

**Fora do escopo:** a tela, a visibilidade por dono/atribuição e a triagem (1.5); as regras de cada envio (Proposta, Contrato, RFQ, Tratativas, Frete) nos módulos 4, 6 e 7.

### S6.2 Onde está
Edge Functions: `send-email` (v24, `verify_jwt: true`), `read-inbox` (v17), `sign-email-anexos` (v7, links de 7 dias para anexos), `suggest-email-reply` (v7, sugestão de resposta com IA). Bucket privado `emails-anexos`. **Conferido** (listagem, 30/10–01/11/2026). As mensagens próprias do vpsistema (convite, recuperação) usam a mesma caixa, por outro caminho (S5.4).

### S6.3 Quem usa
Inbox (1.5), Proposta, Contrato de Venda e do Instalador, RFQ, Tratativas, Frete, Cotações de Varejo, Projeto de Instalação. Chamadores no front: `email-envio-helper.js`, `contrato-venda-store.js`, `logistica.jsx`, `tratativas-store.js` (o `supabase.js` acrescenta `enviadoPor` a cada envio). **Herdado** (levantamento do código, 01/11/2026).

### S6.4 Como entra e sai
- **Envio (`send-email`):** entrada `{to, cc?, subject, text?, html?, replyTo?, numeroCotacao?, referenciaTipo?, referenciaId?, enviadoPor?, attachments[]}`; saída `{ok, destinatarios, cc, messageId, avisoPersistencia}`. Grava a saída em `emails_projeto` (inclusive `cc`) e os anexos em `emails-anexos`. **Conferido.**
- **Leitura (`read-inbox`):** cron `read-inbox-poll` a cada 10 minutos; até 25 mensagens por vez, 3 MB cada; vínculo à cotação por Message-ID ("certo") ou pelo Nº no assunto ("provável"). **Conferido** (cron) / **Herdado** (números do código).
- **Avisos que nascem do e-mail:** resposta recebida e triagem viram linha em `alertas` (gatilhos `trg_alertas_inbox_resposta` e `trg_alertas_inbox_triagem`) e, como todo alerta dirigido, **também viram WhatsApp** pelo gi-avisos (PC-2). Crons `inbox-alerta-sem-resposta` (seg–sex, 4 vezes por hora entre 11 e 21 UTC) e `inbox-acordar-adiados` (a cada 10 minutos). Desde 07/10/2026 a resposta de fornecedor vai ao vendedor, não a todos. **Conferido** (crons) / **Herdado** (regras, `01_geral.md` 1.5).

### S6.5 Regras e janelas
- **Travas da `send-email`, todas antes do SMTP:** formato do endereço (400); no máximo **10 destinatários somando Para + Cc** (400); allowlist — domínios internos, extras autorizados e quem já existe em cadastro/histórico (`email_conhecidos`) (403); limite de taxa de 25 envios por IP e 60 no total a cada 10 minutos (429); se a verificação falhar, **bloqueia** (503); anexos somados até 2,5 MB. **Conferido** (código da v24).
- **Assunto:** ASCII passa direto; acentuado curto segue com a codificação da biblioteca; **acentuado longo perde os acentos** (vira ASCII) para não quebrar o cabeçalho no Outlook. **Corpo** (texto e HTML) vai em Base64. **Conferido** (código da v24, 30/10/2026).
- Excluir e-mail no sistema é só marcar (`excluido_em`); **nunca** se apaga da caixa real. **Herdado** (lei do 1.5).

### S6.6 Dados
`emails_projeto` (**133** linhas; coluna `cc` criada em 30/10/2026), `email_envios_log` (13, base do limite de taxa), `emails-anexos` (bucket). **Conferido** (SQL, 01/11/2026).

### S6.7 Segurança
Secrets por nome: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `IMAP_HOST`, `IMAP_PORT`, `SUPABASE_SECRET_KEYS`, `ANTHROPIC_API_KEY` (só a `suggest-email-reply`). `emails_projeto` está aberta à chave pública (política `ALL` para `anon`). **Conferido** (`pg_policies`). Riscos levantados em A5 e A6.

### S6.8 Falhas e como se percebe
Envio que sai mas não grava devolve `avisoPersistencia` (o e-mail já foi). Falha de leitura aparece no histórico do cron e nos logs da função. **Conferido** (código).

### S6.9 Testes
Redeploy sempre numa cópia descartável primeiro (OPTIONS 204, POST inválido 400, sem `BOOT_ERROR`), conforme a lei. Envio real só com autorização do Gelson e só para endereços dele. **Herdado** (lei do 1.5; prática de 30/10/2026).

### S6.10 Pendências e achados
- **Achado, sem correção (A5):** `read-inbox` e `sign-email-anexos` não conferem quem chama (registrado em `01_geral.md` 1.5).
- **Achado, sem correção (A6):** a allowlist considera "conhecido" quem já mandou e-mail para a caixa; e `suggest-email-reply` não limita taxa (custo de API).
- A migration da coluna `cc` está no PR #1194 (aberto); o banco já tem a coluna.
- Teste real do assunto acentuado longo e do corpo em Base64: aguardando o Gelson.

### S6.11 Histórico
Envio por SMTP direto desde 28/09/2026; travas anti-relay em 01/10/2026; dono do e-mail em 04/10/2026; campo Cc, assunto e corpo corrigidos em 30/10/2026. **Herdado/Conferido.**

---

# Parte comum

## PC-1 Mapa de ligações
```
módulos do hub ──grava──▶ alertas / gatilhos / eventos_fluxo / assinaturas
                                   │ (gatilhos do banco)
                                   ▼
                          eventos_outbox (hub) ──cron 1/min──▶ eventos-publicar ──HMAC──▶ eventos-ingest (vpsistema)
                                                                                                  │
                         vpsistema: Central de Eventos (hub.aviso_fluxo em sombra) ◀───────────────┘
                                   │ eventos.giavisos_ler_hub / pausas
                                   ▼
                          gi-avisos (VPS) ──Claude Haiku──▶ texto ──Evolution pv360──▶ WhatsApp da pessoa
                                   │                                   │
                                   └──▶ eventos.entregas_externas       └── falha 5x ──▶ Telegram (Gelson)

WhatsApp recebido ──pv360──▶ whatsapp-dispatcher (vpsistema) ──▶ 1º Copiloto /whatsapp (VPS) · senão menu RH/Suporte · Pós-Venda 360
                              (decisao-resposta-whatsapp do hub: ninguém chama hoje — A19)
vpsistema ──vpsistema-sync──▶ hub (pessoas, alçadas, celular)      vpsistema ──sso──▶ hub (login)
e-mail: telas ──send-email──▶ SMTP · IMAP ──read-inbox (10 min)──▶ emails_projeto ──▶ alertas ──▶ (mesmo caminho do WhatsApp)
```
**Conferido** (código, migrations e configuração, 01/11/2026, inclusive o `17_gente-gestao`).

## PC-2 Um aviso de ponta a ponta
1. Um módulo grava uma linha em `alertas` com `destinatario_email` (pela tela, por gatilho ou por cron). Ver regras de criação em `01_geral.md` PC-4 (id fixo por fato, `rota` relativa, nunca apagar).
2. O gatilho `trg_evt_aviso_alerta` enfileira um `hub.aviso_fluxo` em `eventos_outbox` (sem telefone). Etapas, eventos de fluxo, resposta de fornecedor e assinaturas entram pela mesma fila por gatilhos próprios.
3. O cron `eventos-publicar-outbox` (a cada minuto) chama `eventos-publicar`, que assina e entrega até 20 eventos à Central; reenvio em 1, 5, 15 e 60 minutos; na 5ª falha vira `falha`. Em 01/11/2026: 745 linhas, 0 pendentes.
4. A Central guarda o evento (em sombra: não envia).
5. O gi-avisos lê, aplica S2.5 (destinatário, autor, palavras, agrupamento, janela, feriado, pausa), pede o texto ao Claude e envia pela `pv360`.
6. O gi-avisos registra a decisão em `eventos.entregas_externas`; a pessoa pode pausar em `vpsistema.com/eventos/destinatarios`.
**Conferido** (migrations `20261015130000`, `20261016120000` e seguintes; código da VPS; contagens).
**Para quem cria aviso (regra prática):** título curto com o essencial na frente; sem "teste" no texto; para não agrupar com outro do mesmo dia, ponha no título o dia da semana por extenso, a obra ou o código do contrato; nunca R$ no título. Mudar título ou módulo de um alerta existente exige combinar antes (`01_geral.md` 1.2).

## PC-3 Endereços e páginas públicas
- `copiloto.vpsistema.com` (Copiloto da VPS; todas as rotas publicadas pelo nginx).
- `https://hub.vpsistema.com/assinar/<código>` (link de assinatura enviado por WhatsApp; página pública do hub, módulos 6 e 11).
- `vpsistema.com/eventos/<aba>` (Central de Eventos; pausas em `destinatarios`).
- Funções públicas por natureza (`verify_jwt: false`): `decisao-resposta-whatsapp`, `sso-exchange`, `vpsistema-sync` (hub); `eventos-ingest`, `eventos-worker`, `whatsapp-dispatcher`, `login-start`, `reset-start` e outras (vpsistema). **Conferido.**

## PC-4 Segurança e segredos
- **Nenhum valor de segredo neste documento** (Art. 28). Os nomes estão em S1.7, S2.7, S3.7, S4.7, S5.7 e S6.7.
- **`alertas` aceita INSERT, SELECT e UPDATE de qualquer papel (`public`)**; como todo alerta dirigido vira WhatsApp, esse problema de segurança já conhecido (#571, `14_administracao.md` PC-4) também afeta quem recebe mensagem. **Conferido** (`pg_policies`, 01/11/2026). Fechar `alertas` é decisão da segurança real (#571).
- **Credenciais compartilhadas entre serviços da VPS** (achado A7): gi-avisos lê a senha do banco no arquivo do Copiloto e o bot no arquivo do Borderô; o Copiloto lê a Evolution e a conexão do vpsistema no arquivo do gi-avisos.
- **A Evolution é alcançável pela internet, sem criptografia** (achado A16, [#1326](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1326)): a porta da API é publicada pelo Docker por fora do firewall (que só libera 22, 80 e 443), e o `whatsapp-dispatcher` do vpsistema a chama pelo IP público, por HTTP. A única proteção é a chave da API. **Conferido** (`ss`, `ufw`, código do dispatcher, 02/11/2026).
- Telefones no repositório (privado desde a conferência de 02/11/2026; o Art. 28 continua valendo): achado A2, [#1312](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1312).

## PC-5 Quem faz o quê
- **Gelson:** decide regras, janelas e mudanças; recebe o alerta de falha pelo Telegram.
- **Pessoas do hub:** recebem avisos; pausam em `vpsistema.com/eventos/destinatarios`; celular cadastrado no vpsistema (administração).
- **Módulos do hub:** criam o aviso (linha em `alertas` ou evento); são donos da regra de negócio.
- **gi-avisos:** decide se e quando envia, e o texto.
- **Claude do repositório / Claude da VPS:** o primeiro mexe no hub; o segundo, nos serviços da VPS; **não mexer no gi-avisos** sem pedido (S2.5).

## PC-6 Edge Functions e crons
**Hub, Edge Functions ligadas a mensagens** (versão e `verify_jwt` conferidos de 30/10 a 01/11/2026): `send-email` v24 (true) · `read-inbox` v17 (true) · `sign-email-anexos` v7 (true) · `suggest-email-reply` v7 (true) · `eventos-publicar` v3 (true) · `decisao-resposta-whatsapp` v1 (false) · ~~`whatsapp-notify` v10~~ e ~~`vp-copiloto` v36~~ (removidas em 01/11/2026) · `sso-exchange` v5 (false) · `vpsistema-sync` v8 (false) · `alerta-pcp-compras` e `alerta-pcp-prazos` (gravam `alertas`). Inventário completo e regras de deploy: `14_administracao.md` PC-6.

**Hub, crons que geram mensagem** (UTC; **Conferido** em `cron.job`, 01/11/2026, todos ativos):

| Job | Agenda | Efeito |
|---|---|---|
| `eventos-publicar-outbox` | a cada minuto | publica a fila na Central |
| `read-inbox-poll` | a cada 10 min | lê a caixa |
| `inbox-acordar-adiados` | a cada 10 min | devolve e-mails suspensos |
| `inbox-alerta-sem-resposta` | :07/:22/:37/:52, 11–21 h, seg–sex | alerta de e-mail sem resposta |
| `pcp-alerta-compras-diario` | 10:00 | alertas de compras |
| `pcp-alerta-prazos-diario` | 10:05 seg–sex | alertas de prazos |
| `pcp-expedicao-alerta-sem-entrega` | 10:10 seg–sex | expedição sem entrega |
| `gatilhos-alerta-prazos-diario` | 10:20 seg–sex | etapas vencidas |
| `pcp-compras-alerta-atrasos` | 10:20 seg–sex | compras atrasadas |
| `obras-alerta-sem-envio-diario` | 10:25 seg–sex | obras sem envio |
| `alertas-expirar-diario` | 10:30 | fecha alertas velhos (não manda mensagem) |
| `pcp-varejo-alerta-parados` | 10:30 seg–sex | varejo parado |
| `decisoes-expirar-orfas-diario` | 10:40 | fecha decisões órfãs |
| `embarques-alerta-rastreio-diario` | 10:40 | rastreio de embarque |
| `embarques-alerta-chegada` | 10:50 seg–sex | chegada de embarque |
| `ci-lembretes-assinatura` | 12:00 seg–sex | lembrete de assinatura do Contrato do Instalador |
| `evolucao-alerta-felipe-diario` | 12:30 seg–sex | cobrança diária da Evolução dos Equipamentos |
| `importacao-varejo-alerta-dia-d` | 03:40 seg–sex | dia D da importação de varejo |

**vpsistema, crons:** `eventos-rotear` (a cada minuto), `eventos-worker` (a cada minuto, só se houver pendente), `eventos-sincronizar-destinatarios` (15 min), `hub-sync-verificar` (10 min), `hub-alcadas-diario` (06:15), `hub-substituicoes-diario` (03:05), `reconcile-satellite-profiles-nightly` (06:00). **Conferido.**

**VPS:** gi-avisos e Copiloto (systemd, sempre ligados); Borderô (cron 13:00 UTC seg–sex); VP Click (cron a cada 15 min e 10:00 UTC). **Conferido.**

## PC-7 Tabelas
**Hub:** `alertas` (576; 224 abertos), `eventos_outbox` (745; 0 pendentes), `eventos_fluxo`, `gatilhos`, `eventos_destino_modulo` (10, quem recebe os avisos globais por módulo), `decisao_whatsapp_numeros` (3), `whatsapp_notification_log` (4), `calendario_feriados` (39 datas que bloqueiam envio), `emails_projeto` (133), `email_envios_log` (13), `perfis`, `colaboradores_vpsistema`, `alcadas_capacidade`, `vp_copiloto_docs`. **vpsistema:** esquema `eventos` (S5.6), `profiles`, `scheduled_broadcasts`, `two_factor_challenges`, `hub_sync_envios`, `hub_sync_falhas`. **Conferido** (contagens de 01/11/2026). **Sem migration no repositório (achado):** a coluna `alertas.destinatario_email` e a tabela `colaboradores_vpsistema` existem no banco, mas não encontrei o arquivo que as cria. **Herdado** (levantamento do repositório).

## PC-8 Testes
Nenhum serviço desta central tem teste automatizado (gi-avisos, Copiloto, ponte, Central). O e2e do hub simula o Supabase e não envia nada. Prova real de envio só com autorização do Gelson e destinatário dele (Art. 10: dado de teste se identifica e se apaga). **Conferido.**

## PC-9 Tutoriais e menu "?"
Os tutoriais do Inbox e das Notificações (`.claude/skills/tutorial-vp-gestao/`) estão defasados em relação ao canal atual. **Herdado.** O menu "?" é descrito em `01_geral.md` PC-10. Não há tutorial dos serviços.

## PC-10 Vizinhos que usam o mesmo número (fora do hub)
| Serviço | Sistema | Como | Observação |
|---|---|---|---|
| `vpclick-cobranca` (VPS, cron) | VP Click | Evolution `pv360`; texto pela API da Anthropic (Haiku 4.5); telefone pelo nome nos contatos do pv360 | **Achado A17:** se a IA falha, o aviso é perdido sem alerta (houve "saldo insuficiente" em 30/10/2026); o log guarda telefones sem máscara |
| Pós-Venda 360 / Verti | pv360 | roda na Hostinger; a VPS só chama um endpoint dele a cada 15 min | a instância `pv360` nasceu dele |
| `whatsapp-mcp` (VPS, systemd) | ferramenta do Claude | envio sob comando | escrita ligada |
| Gente & Gestão | vpsistema (funções implantadas lá) | `whatsapp-dispatcher` recebe todo WhatsApp da `pv360` e distribui (S1.4) | achados A20–A22 |
| Escamax, VPRequisições | outros | sem serviço na VPS | **Herdado** |
**Conferido** (VPS, 01/11/2026), salvo marca.

## PC-11 Documentos soltos e destino do que foi concatenado
Nada foi apagado. Por decisão do Gelson (01/11/2026), **a troca das origens por ponteiro fica para um segundo PR**, depois da aprovação deste documento. Até lá algumas regras aparecem em dois lugares (Art. 44, temporário).

| Origem | O que tinha | Destino |
|---|---|---|
| `serviços.md` (raiz) | rascunho S1–S5 | **virou este documento** (movido) |
| `.claude/gi-avisos-regras-whatsapp.md` | todas as regras do gi-avisos | concatenado em S2.5 e comparado em S2.10; decidir se vira ponteiro (o `CLAUDE.md` o chama de "única cópia") |
| `CLAUDE.md` "Serviços transversais", Arts. 38 e 41 | plano em `docs/servicos/` | **emenda pedida pelo Gelson (01/11/2026)**: vira ponteiro para cá no PR seguinte |
| `CLAUDE.md` "Evolução dos Equipamentos" | fatos do gi-avisos (palavras, 400 caracteres, log, telefone) | S2.5/S2.6; parte de negócio → módulo 9 |
| `CLAUDE.md` "Copiloto VP", "RFQ Importação" (Copiloto da VPS) | `vp_copiloto_docs`, `novaConversa` | S3.5; negócio → módulos 7 e 8 |
| `CLAUDE.md` "ÁREA BLINDADA — E-mail/Inbox" | lei do e-mail | **fica** (lei); S6 aponta |
| `01_geral.md` PC-4 | alertas como barramento, gi-avisos, fila | gi-avisos e fila → S2 e PC-2; regras de criação de alerta **ficam** no 01 |
| `01_geral.md` 1.5 | Inbox inteiro | tela e lei **ficam**; canal → S6 |
| `01_geral.md` 1.3 | aval por WhatsApp | regra → 1.3/módulo 11; mecânica → S1.5 |
| `11_parceiros_instaladores.md` (fila, `decisao-resposta-whatsapp`) | mecânica de eventos | → S1/PC-2; aval fica no 11 |
| `14_administracao.md` PC-6/PC-7 (integrações) | inventário | fica; PC-6 daqui aponta |
| `09_obras_instalacao.md` (ART, Evolução) | avisos via gi-avisos | regra do canal → S2/PC-2; negócio fica no 9 |
| `02`, `04`, `06`, `07` (`wa.me`, e-mail por tela) | atalhos manuais, envios | ficam nos módulos (S1.1 e S6.1 apontam) |
| `docs/eventos/vphub-instalador.md` | manual da fila e da Central para os avisos do instalador (15/10) | **virou ponteiro** (01/11/2026, decisão do Gelson), sem os telefones; o plano dele nunca foi ligado (A23) |
| `docs/superpowers/specs/2026-10-24-evolucao-qualidade-dados.md`, `2026-10-30-art-por-obra.md` | `bloqueia_envio`, agrupamento, ART | histórico; regras já em S2.5 |
| `docs/superpowers/specs/2026-10-25-rfq-importacao-vencedor-pi/02-clarify.md` | contrato do Copiloto da VPS | S3 |
| `docs/superpowers/specs/2026-10-31-mapa-de-destino-docs-soltos.md` | destinos antigos | **desatualizado** (não prevê este documento) |
| `AUDITORIA_FORENSE_E2E_SCORE.md` | riscos E2E-006 (`whatsapp-notify`), E2E-044 (`read-inbox`) | citado em S1.10 e S6.10; fica |
| `README.md`, `docs/CONTEXTO_workflow_setores_vpclick.md`, `.claude/agents/*`, relatórios antigos | menções conceituais ou obsoletas | ficam (histórico); `CONTEXTO_workflow_setores_vpclick.md` **tem um segredo** (A18) |

## PC-12 Benefícios trocados com os módulos
**Doados (a acrescentar nos módulos no PR de ponteiros, Art. 49):** (1) a regra prática "como escrever um aviso que chega certo" (PC-2) para todo módulo que cria alerta; (2) "todo alerta dirigido vira WhatsApp" para os módulos 1, 9, 11, 12 e 13; (3) "o Copiloto da VPS não lê `vp_copiloto_docs`" para os módulos 4, 5, 6, 8 e 10. **Recebidos:** do 1 (regras de `alertas`), do 11 (aval e assinaturas), do 14 (inventário e segurança).

---

## Quadro de achados, com issue
Nenhum foi corrigido aqui (Art. 45). **Cada achado tem uma issue** no repositório 010 (privado; achados do vpsistema também ficam aqui, porque o repositório dele é público). A decisão e a correção acontecem na issue; quando ela for fechada, esta linha é atualizada. Ordem: numeração do documento.

| Nº | Achado | Onde | Issue |
|---|---|---|---|
| A1 | ~~`whatsapp-notify` no ar sem trava e sem chamador~~ — **removida em 01/11/2026** | S1.10 | — (resolvido) |
| A2 | Telefones de pessoas no repositório (migrations, comentário de função); o 010 está **privado** (02/11/2026) | S1.10 | [#1312](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1312) |
| A3 | Um só número/instância para todos os serviços; reserva desconectada | S1.10 | [#1313](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1313) |
| A4 | Central de Eventos com regras "ativas" que nunca enviam | S5.10 | [#1314](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1314) |
| A5 | `read-inbox` e `sign-email-anexos` sem conferência de quem chama | S6.10 | [#1315](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1315) |
| A6 | Allowlist aceita quem já escreveu para a caixa; `suggest-email-reply` sem limite de taxa | S6.10 | [#1316](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1316) |
| A7 | Credenciais compartilhadas entre serviços da VPS | PC-4 | [#1317](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1317) |
| A8 | Pessoa inativa pode receber aviso do gi-avisos | S2.10 | [#1318](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1318) |
| A9 | R$ não mascarado no título do aviso | S2.10 | [#1319](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1319) |
| A10 | Copiloto conta pergunta recusada; cota só em memória | S3.10 | [#1320](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1320) |
| A11 | Ponte do Telegram sem trava de ferramentas; troca do token pendente | S4.7 | [#1321](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1321) |
| A12 | Horário do Borderô errado no texto do script | S4.10 | [#1322](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1322) |
| A13 | Segredo de reserva no código do vpsistema (repositório **público**, conferido 02/11/2026) | S5.7 | [#1323](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1323) |
| A14 | Mensagens próprias do vpsistema sem registro na Central | S5.10 | [#1324](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1324) |
| A15 | vpsistema: funções no ar sem pasta e pasta sem função | S5.10 | [#1325](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1325) |
| A16 | Evolution alcançável pela internet, sem criptografia (**Conferido** 02/11/2026) | PC-4 | [#1326](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1326) |
| A17 | VP Click perde aviso em silêncio quando a IA falha; log com telefones sem máscara | PC-10 | [#1327](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1327) |
| A18 | Documento antigo com segredo (`docs/CONTEXTO_workflow_setores_vpclick.md`) | PC-11 | [#1328](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1328) |
| A19 | **Aval por WhatsApp não decide nada** — decidido ligar (02/11); [PR 17_gente-gestao#62](https://github.com/verticalpartsIA/17_gente-gestao/pull/62) pronto, publicação na fase operacional | S1.5 | [#1329](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1329) |
| A20 | RH: resposta de candidato pode cair no menu; `@lid` e mídia | S1.10 | [#1330](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1330) |
| A21 | `evolution-webhook-admin` e `admissao-portal` (pública, dados pessoais) no ar sem código no repositório | S1.2 | [#1331](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1331) |
| A22 | Resposta dupla se o Copiloto passar de 12 s | S1.10 | [#1332](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1332) |
| A23 | Gatilhos `instalador.*` da Central nunca ligados; ~24 alertas `ci-` sem destinatário (o "contrato assinado" real sai pelo gi-avisos a Cleiton, Maurício e Felipe, como deve ser) | S5.10 | [#1333](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1333) |
| A24 | Credenciais que apareceram sem máscara numa sessão do Claude (01/11/2026): decidir a troca | PC-4 | [#1335](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1335) |
| A25 | README do gi-avisos desatualizado (diz "lê o hub, só leitura") | S2.10 | [#1336](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1336) |
| A26 | Espelho `colaboradores_vpsistema` com 51 ativos × 48 perfis no vpsistema | S5.10 | [#1337](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1337) |
| A27 | Pendências herdadas das regras do gi-avisos (cliente sem vendedor; exceções de horário) | S2.10 | [#1338](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1338) |
| A28 | Copiloto: "Descrição com IA" apaga a conversa da bolinha (falta modo sem memória) | S3.10 | [#1339](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1339) |
| D1 | Copiloto e `vp_copiloto_docs` — decidido "opção a" (02/11); pronto na VPS, publicação na fase operacional | S3.10 | [#1334](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1334) |
| — | `alertas` aberta a escrita pela chave pública (já conhecido) | PC-4 | [#571](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/571) |

**Trabalho operacional que nasceu deste documento** (próxima fase, cada passo com "Confirmo", Art. 14): [#1329](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1329) (publicar o SIM/NÃO do aval) e [#1334](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1334) (publicar o Copiloto lendo `vp_copiloto_docs`). Também ligados aos serviços e ainda abertos: PR [#1194](https://github.com/verticalpartsIA/010_GestaoImportacao/pull/1194) (migration da coluna `emails_projeto.cc`, já criada no banco) e [#1237](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1237) (comentário do limite de taxa do `send-email`).

## Decisões do Gelson (01/11/2026)
1. **Documento aprovado** (status REAL).
2. **Segundo PR autorizado:** ponteiros nas origens e doações aos módulos (Art. 49/50).
3. **Apontamento no `CLAUDE.md`:** o Art. 41, o mapa e a seção "Serviços transversais" passam a apontar para este documento.
4. **Fica como está:** o Telegram (conversa, Borderô, alerta de falha); o vpsistema continua recebendo os gatilhos como hoje; avais e avisos seguem como estão.
5. **`whatsapp-notify` e `vp-copiloto`:** remover **se forem obsoletas**; se a estrutura funciona, manter. Conferido em 01/11/2026: as duas estão sem chamador no código e sem chamada nas últimas 24 h; `whatsapp-notify` não registra uso desde 15/10/2026 e o próprio serviço da VPS se declara substituto da `vp-copiloto`. **Removidas em 01/11/2026** com o "Confirmo remoção" do Gelson (Art. 14); pastas em `supabase/functions-removidas/` (Art. 23).
6. **Leitura do `17_gente-gestao`:** autorizada e feita (S1.4, S5.2).

## Decisões do Gelson (02/11/2026)
1. **Merge:** "Confirmo o merge do #1299 e do #1300". O #1299 foi mergeado; o #1300 depende de a base dele passar a ser `main`.
2. **Aval por WhatsApp (A19):** "ligue o SIM/NÃO do WhatsApp à decisão" → PR [17_gente-gestao#62](https://github.com/verticalpartsIA/17_gente-gestao/pull/62), [#1329](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1329).
3. **`vp_copiloto_docs` (D1):** "opção a" — o Copiloto da VPS passa a ler a tabela → [#1334](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1334).
4. **Achados:** "monte a proposta" e, em seguida, "se encontrar algo fora desse contexto crie issues": cada achado virou issue (quadro acima). **Primeiro se fecha toda a parte documental; depois vem a parte operacional.**

## Pendências para o Gelson (o Claude da VPS não decide)
1. ~~Remover `whatsapp-notify` e `vp-copiloto`~~ **Feito em 01/11/2026** com o "Confirmo remoção" do Gelson: apagadas da produção (respondem 404), pastas movidas para `supabase/functions-removidas/`; as versões de produção (diferentes do repositório; a do `whatsapp-notify` tinha telefone fixo) estão guardadas só na VPS.
2. ~~Aval por WhatsApp (A19): quer que seja ligado?~~ **Respondida (02/11/2026): ligar.** Publicação na fase operacional ([#1329](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1329)).
3. ~~Copiloto e `vp_copiloto_docs` (D1)~~ **Respondida (02/11/2026): opção "a", o Copiloto passa a ler.** Publicação na fase operacional ([#1334](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1334)).
4. **Achados:** cada um tem issue (quadro de achados); decidir em cada issue, com "Confirmo" para o que mexer em produção.
5. ~~`docs/eventos/vphub-instalador.md`~~ **Resolvido (01/11/2026):** virou ponteiro, sem telefones (os números antigos continuam no histórico do Git). Cleiton recebe o "contrato assinado" e o Gustavo não, como o Gelson quer (nada mudou no serviço).

### Divergências registradas (Art. 12 — nenhuma corrigida)
- **D1 — Copiloto e `vp_copiloto_docs`:** `CLAUDE.md` e módulos 4, 5, 6, 8 e 10 dizem que a tabela alimenta o Copiloto; o Copiloto em uso (VPS) não a lê. Decidido em 02/11/2026 que vai ler; vale até a publicação ([#1334](https://github.com/verticalpartsIA/010_GestaoImportacao/issues/1334)).
- **D2 — de onde o gi-avisos lê:** `CLAUDE.md` ("Evolução dos Equipamentos") e `01_geral.md` PC-4 dizem `alertas`; o código lê a Central (`hub.aviso_fluxo`, cinco origens).
- **D3 — janela:** os mesmos textos dizem "janela por departamento (Engenharia 07–18)"; o código tem a janela padrão para todos e a exceção da Juliana.
- **D4 — feriados:** as regras do gi-avisos dizem "leitura do hub desligada"; está ligada desde 24/10/2026.
- **D5 — montador:** as regras exigem `externo:true`; o código usa "sem e-mail + com telefone" e só o papel "Contratado".
- **D6 — quem aprova o aval:** `docs/eventos/vphub-instalador.md` e o comentário de `decisao-resposta-whatsapp` dizem Diego; módulo 11 e banco dizem Juliana.
- **D7 — `whatsapp-notify`:** `14_administracao.md` PC-7 a lista como integração em produção; ela não tinha chamador e foi **removida em 01/11/2026**.

## Fatos do rascunho corrigidos
| Rascunho dizia | O código e o banco mostram (01/11/2026) |
|---|---|
| gi-avisos entrega a tabela `alertas` | entrega `hub.aviso_fluxo` da Central, com cinco origens (`alertas` é uma delas) |
| janelas por departamento (Engenharia 07–18) | não existe: janela padrão 07–18 para todos + Juliana/Precificação 09:30–17:30 |
| validação da `decisao-resposta-whatsapp` "Não verificado" | existe (HMAC, 5 min, número aprovador, limites) — S1.5 |
| a Juliana responde o aval do montador | **confirmado** (módulo 11 e banco); o comentário da função ainda diz Diego e está velho (D6) |
| telefone do montador vem de `parceiros_instaladores` | o gi-avisos só usa o telefone que vem no aviso; a origem no hub: **Não verificado** |
| Copiloto da VPS e `vp-copiloto` podem ser o mesmo | são diferentes; o front só chama a VPS |
| o vpsistema envia direto ou pelo gi-avisos? | os dois: avisos do hub só pelo gi-avisos; mensagens próprias do vpsistema direto pela Evolution |
| não há nada de Telegram | não há no hub nem no vpsistema; há na VPS (S4) |

---

**Histórico deste documento**
- 01/11/2026: rascunho `serviços.md` criado pelo Claude do repositório (raiz).
- 01/11/2026: movido para `docs/modulos/15_servicos.md` por ordem do Gelson e escrito pelo Claude da VPS, com conferência do código da VPS, do banco do hub e do vpsistema e dos documentos do repositório. Status: em aprovação.
- 01/11/2026: aprovado pelo Gelson (status REAL); removidas `whatsapp-notify` e `vp-copiloto`; ponteiros e doações no PR seguinte.
- 02/11/2026: fechamento da parte documental: 28 issues de achados e de trabalho operacional (#1312–#1339) ligadas ao quadro; decisões de 02/11; correções "010 privado" e "A16 confirmado".
