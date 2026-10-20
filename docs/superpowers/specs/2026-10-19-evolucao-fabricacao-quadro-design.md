# Evolução da Fabricação do Quadro de Comando — spec de design

Data: 2026-10-19 · Status: **rascunho para revisão do Gelson** · Nenhum código foi escrito.
Pedido de origem: conversa no chat (sem issue aberta ainda).

## 1. Objetivo

Hoje a fabricação do quadro de comando (o painel elétrico do elevador, montado internamente) é uma etapa única e "cega" dentro do PCP: a OP de produção (`pcp_ordens`, frente `quadro`) só sabe "Separar materiais → Montagem do quadro → Qualidade/aprovação" — sem visibilidade de quanto da montagem já foi feito nem de problemas no caminho.

Objetivo: criar uma tela nova — **"Evolução da Fabricação"**, dentro do grupo de menu Fabricação, logo depois de "Montagem do Produto" — que mostra, para cada quadro de comando sendo fabricado, uma linha do tempo com as etapas reais da montagem, preenchida pelo próprio funcionário da fabricação por um **link sem login** (mesmo espírito do Diário de Obra, `acompanhamento_obra_*` / `/diario-obra/:token`), mais uma seção de **ocorrências** (falta de material) que não atrapalha a leitura da linha do tempo.

## 2. O que já existe (achados no código)

- **`quadros_comando`** (migration `20260917120000_quadro_comando_schema.sql`): 1 linha por quadro vendido — `numero_pedido`, `numero_cotacao`, `status`, `cliente_id`, tabelas filhas `quadros_comando_bom_itens` (estrutura/BOM), `quadros_comando_maquina` (`potencia_kw`, `tensao_v` — são as combinações 220/380V × 7,5/15/30kW, 6 modelos). Pedido de venda vem do Omie.
- **`pcp.jsx` → `PCPPedidosQuadro`**: já lista os quadros e gera a **OP-mãe + OPs-filhas** (`pcp_ordens`) a partir do pedido do Omie — isso já é o "módulo Fabricação" que você mostrou. A OP da frente `quadro` guarda `quadro_comando_id` e hoje tem só 3 etapas fixas em `pcp_ordem_etapas` (Separar materiais / Montagem do quadro / Qualidade-aprovação).
- **`acompanhamento-obra-store.js`** (Diário de Obra): o motor que você quer copiar — checklist com peso por item, link fixo sem login, o montador só *acrescenta* (nunca desmarca), 100% só com todos os itens flegados, % ponderada alimenta um anel/card. É o molde técnico desta feature nova, **sem a parte de foto obrigatória/câmera/EXIF** (não combinamos isso aqui — é funcionário interno, não terceiro).
- **`montagem-produto.jsx`**: padrão de campo "código com sugestão" (`<input list=... /><datalist/>`) que vamos reaproveitar no campo de ocorrência (digitar o código do item faltante, com sugestão vinda da estrutura do próprio quadro).

## 3. O que muda

A etapa única "Montagem do quadro" (hoje dentro de `pcp_ordem_etapas` da OP `quadro`) ganha uma linha do tempo própria, com 6 passos fixos (ordem combinada com o Gelson):

1. Furação do gabinete
2. Fixação de calhas e trilhos DIN
3. Acoplagem de disjuntores e contatores; fixação de botoeira de inspeção, inversor, resgate, base de terminais e barramento de fio-terra
4. Fiação de ligação entre terminais, placas e outros componentes (origem e destino)
5. Fixação do resistor de frenagem
6. Teste do quadro

A linha nasce com essas 6 etapas "no azul" (como se tudo fosse dar certo) e vai sendo marcada conforme o funcionário avança fisicamente no quadro. **Não existe foto obrigatória** — é um check simples.

## 4. Modelo de dados (proposta)

Nova família de tabelas, no mesmo espírito de `acompanhamento_obra_*`, mas pendurada na **OP do quadro** (`pcp_ordens.id` onde `frente = 'quadro'`) em vez de num dossiê de obra — porque o quadro é fabricado na VerticalParts, antes (ou independente) de qualquer obra de instalação ter dossiê:

- **`fabricacao_quadro_itens`** — catálogo fixo das 6 etapas: `id`, `texto`, `ordem`, `peso`. *(Pendência do Gelson: os pesos — proponho **iguais**, ~16-17 cada, até você decidir se alguma etapa pesa mais que outra; ver seção 8.)*
- **`fabricacao_quadro_links`** — `ordem_id` (FK `pcp_ordens`), `token`, `criado_por`, `criado_em`. Um link por OP de quadro (gerado uma vez, igual ao Diário de Obra).
- **`fabricacao_quadro_status`** — `ordem_id`, `item_id`, `flegado` (bool), `flegado_em`, `flegado_por` (null = veio do link do funcionário). Sem campo de foto. Campo `observacao` opcional, texto livre.
- **`fabricacao_quadro_ocorrencias`** — `id`, `ordem_id`, `codigo_produto` (o que o funcionário digitou — **sugerido** pela estrutura do quadro, mas aceita código avulso que não está na BOM, ex.: ferramenta), `descricao_produto` (resolvida do cadastro quando existe; senão o texto digitado mesmo), `tem_frente_trabalho` (bool, respondida na hora de abrir), `status` (`aberta` / `resolvida`), `aberta_em`, `resolvida_em`. **Insert + update, nunca delete** (fica o histórico).

**"Pausado" não é uma coluna**: um quadro aparece como pausado quando existe uma ocorrência `aberta` com `tem_frente_trabalho = false` para aquela OP — calculado na hora, não guardado, pra nunca ficar fora de sincronia.

Reaproveita `resumoProgresso` (mesma fórmula do Diário de Obra: ponderado, 100% só com tudo flegado) — só troca a fonte das linhas (`fabricacao_quadro_status` + `fabricacao_quadro_itens`) no lugar de `acompanhamento_obra_*`.

## 5. Tela interna — "Evolução da Fabricação"

- **Menu:** grupo **Fabricação**, item novo logo depois de "Montagem do Produto". Rota nova `evolucao-fabricacao` (`KNOWN_ROUTES` em `router.js`), URL `/logistica/evolucao-fabricacao` (mesma convenção do resto do grupo — a URL continua `logistica`, só o menu mostra "Fabricação", igual já acontece com Montagem do Produto).
- **Conteúdo:** 1 card por quadro em fabricação — toda OP com `frente = 'quadro'` em `aguardando` ou `em_producao` (OPs `concluida`/`cancelada` somem da lista). Aparece desde a criação da OP, com as 6 etapas zeradas, até alguém marcar a 1ª — no estilo visual já existente em "Evolução dos Equipamentos" (`evolucao-equipamentos.jsx` — etapa atual pulsando, feitas em verde, % em anel). Cabeçalho do card: cliente, nº do pedido, modelo (tensão + potência).
- **Botão "Gerar link"** (igual ao de `dossier-obra.jsx`): cria/recupera o token, copia a URL pra área de transferência, toast "envie pro funcionário da fabricação".
- **Seção de ocorrências** do quadro, separada da linha do tempo (não entra como nó dentro dela) — lista as ocorrências abertas (piscando) e resolvidas daquele quadro.
- *(Minha proposta, a confirmar): dentro do sistema, quem tem a alçada também pode marcar/desmarcar a etapa direto na tela (sem precisar do link) — útil se o funcionário esquecer de preencher. Mesmo padrão de alçada do Diário de Obra (`instalacao.editar_status_obra`), aqui seria algo como `fabricacao.editar_status_quadro`.*

## 6. Página pública — link do funcionário

Novo arquivo solo, mesma receita do `diario-obra.html` / `diario-obra-app.jsx`, **sem câmera/EXIF/geolocalização**:

- Rota `/fabricacao-quadro/:token` (`server.js` entrega `fabricacao-quadro.html`).
- Lista as 6 etapas com checkbox; marcar já grava (sem exigir foto, sem exigir lote "enviar" — cada check é uma gravação imediata, mais simples que o Diário de Obra porque não há lote de fotos pra subir).
- Barra de progresso (%) igual à do Diário de Obra.
- Botão/link **"Relatar falta de material"**: abre um campo de código (com sugestão vinda da estrutura do quadro, mesmo padrão do datalist de Montagem do Produto) + pergunta **"Tem frente de trabalho?"** (sim/não).
  - **Sim** → ocorrência fica registrada como aberta, a linha do tempo das 6 etapas continua normal.
  - **Não** → ocorrência aberta e o quadro aparece como **pausado** (na tela interna e, com um aviso, na própria página pública) até ser resolvida.
- Seção separada (abaixo da linha do tempo) com as ocorrências daquele quadro — abertas piscando, resolvidas em verde riscado. Cada ocorrência aberta tem um botão **"Chegou — resolver"**, que o próprio funcionário aciona (sem precisar de ninguém de dentro do sistema) — vira verde na hora.

## 7. Ocorrências — resumo do fluxo combinado

1. Funcionário digita o código do item faltante (ex.: Transformador) → sistema pergunta se tem frente de trabalho.
2. **Sim**: ocorrência fica aberta numa seção própria (não interrompe a linha do tempo); funcionário segue marcando as próximas etapas normalmente.
3. **Não**: ocorrência aberta e o quadro fica pausado (sem travar o preenchimento de etapas já feitas, só sinaliza que a produção daquele quadro parou).
4. Quando o material chega, o **próprio funcionário** reabre a ocorrência pelo link e marca que chegou — ela vira resolvida/verde, e se o quadro estava pausado, volta a andar.
5. **Fora do escopo desta entrega**: gerar requisição de compra automaticamente ou notificar Compras/Almoxarifado pelo sistema — você confirmou que o time já consegue abrir a requisição por fora (app próprio de Requisições). Pode virar um botão de atalho numa fase futura, mas não é necessário agora.

## 8. Decisões do Gelson e pendências

### 8.1 Já decidido nesta conversa
1. Entidade: 1 linha do tempo por **quadro de comando vendido** (não por lote/pedido agregado).
2. 6 etapas fixas (listadas na seção 3), sem foto obrigatória.
3. Tela nova, dentro de Fabricação, depois de Montagem do Produto.
4. Ocorrências ficam numa **seção separada**, nunca como nó dentro da linha do tempo.
5. Ocorrência pergunta "tem frente de trabalho?" → define se a linha do tempo segue ou o quadro pausa.
6. O item faltante é **digitado por código**, vindo da estrutura (BOM) do próprio quadro.
7. Quem fecha a ocorrência é o **próprio funcionário**, pelo mesmo link — sem gate de operador interno.
8. Sem notificação automática a Compras/Almoxarifado — a requisição é gerada por fora, por enquanto.

### 8.2 Decisão minha (revisor independente confirmou que é seguro copiar o padrão existente)
- **Ordem de preenchimento das 6 etapas**: livre, igual ao Diário de Obra (`resumoProgresso` não exige sequência — qualquer item pode ser flegado a qualquer momento). "Etapa atual" na tela/card é só uma regra derivada: o primeiro item ainda não flegado na `ordem`. Não trava o funcionário numa ordem rígida porque a vida real de bancada às vezes adianta uma etapa fora de ordem.

### 8.3 Decidido pelo Gelson (19/10/2026, 2ª rodada)
4. **Pesos das 6 etapas**: iguais (~16-17% cada). Confirmado.
5. **Desmarcar por engano**: permitido, mas **só por dentro do sistema** (mesmo padrão do Diário de Obra — `desflegarItem` copiado + alçada própria, ex. `fabricacao.editar_status_quadro`). O link público nunca desmarca, só acrescenta.
6. **Quem vê a tela interna**: fica aberta pra quem já acessa o grupo Fabricação — sem alçada nova de visualização.

### 8.5 Decidido pelo Gelson (19/10/2026, 3ª rodada) — fecha o design
7. **Refabricação/retrabalho**: pode acontecer (2ª OP de fabricação pro mesmo quadro vendido). Como a linha do tempo é guardada pela **OP** (`pcp_ordens.id`, não pelo quadro), cada OP nova nasce com sua **própria linha do tempo zerada** — não herda o progresso de uma OP anterior do mesmo quadro. É o comportamento mais simples e já é consequência direta de guardar por OP; fica registrado aqui para não ser mudado sem perceber.
8. **Quando o quadro aparece na tela**: desde a criação da OP (status `aguardando`), com as 6 etapas **zeradas**, até alguém "dar start" (marcar a 1ª etapa). OPs `cancelada` não aparecem na lista.
9. **Ocorrência com item fora da estrutura do quadro**: **permitido** — o campo sugere os códigos da BOM do quadro (datalist, como em Montagem do Produto), mas aceita digitar algo **avulso que não está na estrutura** (exemplo do Gelson: falta de uma ferramenta). Ou seja, a sugestão é conveniência, não trava: nunca bloqueia o relato por causa de um código que não existe na BOM.

## 9. Fora do escopo (por agora)

- Gerar requisição de compra a partir da ocorrência (time já tem seu próprio app de Requisições).
- Notificação automática por e-mail/WhatsApp quando uma ocorrência abre.
- Foto como prova de etapa concluída (decisão explícita: não precisa, é funcionário interno).
- Mudar a estrutura de preço/custo (`pcp_ordem_materiais`) — esta feature só acompanha progresso, não mexe em custo nem em estoque.

## 10. Arquivos previstos

- `supabase/migrations/2026XXXX_fabricacao_quadro_schema.sql` — as 4 tabelas da seção 4 + seed dos 6 itens.
- `src/fabricacao-quadro-store.js` — motor (espelha `acompanhamento-obra-store.js`, sem foto/EXIF; `resumoProgresso` reaproveitado/adaptado).
- `src/evolucao-fabricacao-quadro.jsx` — tela interna (cards + botão gerar link + seção de ocorrências), reaproveitando o visual de `evolucao-equipamentos.jsx`.
- `fabricacao-quadro.html` + `src/fabricacao-quadro-app.jsx` — página pública (molde de `diario-obra.html`/`diario-obra-app.jsx`, sem câmera).
- `src/router.js` (`KNOWN_ROUTES`), `src/shell.jsx` (item de menu + breadcrumb), `src/app.jsx` (`case`), `server.js` (rota `/fabricacao-quadro/:token`), `index.html` (`?v=` dos novos scripts), `docs/MAPA_DE_ROTAS.md` (gerado por `node scripts/gerar-mapa-rotas.js`).
- Testes: `src/fabricacao-quadro-calc.test.js` (fórmula de % e de "pausado"), cobrindo o mesmo tipo de caso que `acompanhamento_obra` já cobre.

## 11. Verificação (antes de declarar pronto)

- Teste unitário do `resumoProgresso` adaptado (pesos, 100% só com tudo flegado).
- Gerar um quadro de teste, abrir o link público num celular, marcar as 6 etapas, conferir que a tela interna reflete em tempo real (F5).
- Relatar uma ocorrência com "tem frente de trabalho = sim": linha do tempo continua editável. Com "não": quadro aparece pausado na tela interna.
- Resolver a ocorrência pelo link: fica verde, quadro despausa.
- Rodar `npm test` (suíte inteira) sem quebrar nada em `acompanhamento-obra` ou `evolucao-equipamentos` (não tocamos nelas, só criamos tabelas/arquivos novos).
