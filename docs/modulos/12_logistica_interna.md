# 12 Logística Interna — documento do módulo (REAL, fonte da verdade — 01/11/2026)

> **Status: REAL (documento oficial do módulo 12), aprovado pelo Gelson em 01/11/2026**, no molde de `01_geral.md` a `11_parceiros_instaladores.md`. Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que este módulo pede cuidado:** é onde o **estoque físico** vira **pedido separado, etiquetado e despachado**, e onde o site **escreve no Omie** (ajuste de estoque, requisição de compra). Três coisas pedem atenção: (1) a **regra de ouro** — saída por **venda** não vai ao Omie (a NF já baixa lá); só consumo de produção, perda e ajuste de contagem vão, e só com confirmação (PC-4); (2) várias tabelas do módulo estão **abertas à chave pública** do banco, inclusive `pcp_produtos`/`pcp_estoque` (com custo) e `pcp_expedicoes` (PC-6); (3) a **Separação** tem a mesma fila usada pelo **celular** (app `013_Estoque`, fora deste repositório), então mexer na fila no hub pode mudar o que o celular faz (12.3.8).
>
> **Fonte da verdade:** o código e o banco, conferidos em 01/11/2026 (`origin/main` `307ee15`). **Conferido** = lido no código ou consultado no banco (só SELECT) nesta data; **Herdado** = veio do `CLAUDE.md`, de spec/migration ou de documento de outro módulo e **não** foi reconferido; **Não verificado** = não consegui confirmar. Sem selo vale como Não verificado (Art. 6).
>
> **Escopo do módulo:** as **quatro** telas do grupo "Logística Interna" do menu (`NAV_GROUPS` em `shell.jsx`, nesta ordem): **Almoxarifado**, **Expedição**, **Separação** e **Etiquetas**. Pertence à Separação, sem item de menu, o **painel de TV** público (`/separacao-tv/<token>`). **Não** são deste módulo: PCP, MES, Carga Máquina, Montagem, **Fabricação Corrimão/Corte**, Evolução da Fabricação, Simulação e Relatórios (grupo "Fabricação" do menu, módulo 13); **Emissão de NF** (5.4 — a Expedição só lê o resultado); **Compras** do varejo (`/logistica/compras`, 7.9); **Pedidos de Quadro** e Matérias-Primas/Produtos (13); o app de contagem `013_Estoque` (repositório próprio — só o contrato de tabelas está aqui, PC-2).
>
> **Onde moram arquivos que não têm nome óbvio (Conferido):** o Almoxarifado é `almoxarifado.jsx` (1.220 linhas) **mais** `almoxarifado-compras.jsx` (aba Pedidos de compra), `ajustes-estoque.jsx` (aba Ajustes), `reposicao-pcp.jsx` (Reposição), `necessidade-pcp.jsx` (Necessidade) e `compra-pcp.jsx` (janela "Enviar compra ao Omie", usada pelas duas anteriores); as regras puras estão em `reposicao-calc.js` e `necessidade-calc.js`. A Separação é `separacao.jsx` (460) e a TV é `separacao-tv.jsx` (259, página própria `separacao-tv.html`). Etiquetas: `etiquetas.jsx` (1.390), `etiquetas-calc.js` (1.108, modelos e ZPL), `etiquetas-store.js`, `etiquetas-impressoras.js`.

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md`. Aqui vale a mesma: módulo = **12**; telas filhas = **12.1 a 12.4**, na ordem do menu; o conteúdo comum fica na **Parte comum**, sem número de tela.
- **Tudo o que é aba, janela ou página pública de uma tela pertence a ela.** No 12.1 estão as sete abas do Almoxarifado; no 12.3, as abas Pedidos a separar e Painel TV e a página da TV.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
12. **Logística Interna**
   12.1 Almoxarifado (Estoque, Estrutura, Custos, Reposição, Necessidade, Ajustes, Pedidos de compra) · 12.2 Expedição · 12.3 Separação (Pedidos a separar, Painel TV e a página pública da TV) · 12.4 Etiquetas (Gerar, Modelos, Histórico)
   &nbsp;&nbsp;&nbsp;Cada tela tem os temas: x.1 O que é · x.2 Rota e arquivos · x.3 Perfil e acesso · x.4 O que a tela mostra · x.5 Botões e controles · x.6 Comportamento · x.7 Dados (lê/grava) · x.8 Regras e armadilhas · x.9 Testes · x.10 Pendências e decisões · x.11 Histórico
   Parte comum de Logística Interna (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 O estoque de ponta a ponta · PC-3 Rotas, páginas públicas e arquivos · PC-4 A regra de ouro do Omie e os "estoques" que existem · PC-5 Quem faz o quê (alçadas) · PC-6 Identidade, alçadas e segurança · PC-7 Gatilhos, eventos, crons e funções · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
13. Fabricação → `13_fabricacao.md` (REAL)

## Glossário (módulo Logística Interna)
Termos gerais (alçada, soft-delete, evento de fluxo, Nº da cotação) estão em `01_geral.md`. Não se repetem aqui.
- **Almoxarifado:** a tela do estoque **do PCP** (itens de fabricação: cabos, corrimãos, componentes de quadro). O estoque dos ~1.700 itens de revenda importada é a tela **Compras** (7.9); os dois leem o mesmo saldo do Omie.
- **Saldo / físico / reservado / disponível:** vêm do Omie (`ListarPosEstoque`); **disponível = físico − reservado**.
- **Contagem física:** o que a pessoa contou; vive em `importacao_varejo_contagem` (+ `_hist`), **a mesma tabela** para o Almoxarifado, a Compras e o app de contagem.
- **Ajuste (de contagem):** movimento no livro-razão (`estoque_movimentos`) gerado quando a contagem difere do saldo; só vai ao Omie depois de **Confirmar** e de **Enviar ao Omie**, item a item.
- **Reposição:** o que comprar e quando, por **consumo médio × prazo de chegada** (não por estoque mínimo). **Necessidade:** o que falta para atender os pedidos **já vendidos**.
- **Endereço:** posição no galpão no formato `R<rua><vão><nível>` (ex.: `R2A4`) ou `EXP`; 236 posições + `EXP` em `estoque_enderecos`.
- **Separação:** juntar, no almoxarifado, os itens de um pedido de venda do Omie (etapa 20). **Parcial** = separação com itens pendentes (na operação, aguardando chegada ou falta).
- **Painel TV:** página pública que mostra a fila de separação; o **link é a senha**.
- **Expedição:** despacho e entrega do pedido **faturado**; só libera com NF emitida.
- **Etiqueta / modelo / adaptador:** o desenho em mm (modelo), a linguagem da impressora (ZPL) e o caminho até ela (Zebra Browser Print ou diálogo do navegador).

---

## 12.1 Almoxarifado

### 12.1.1 O que é
O estoque **do PCP** (cabos de aço, de manobra, corrimãos, componentes dos quadros): saldo, contagem, endereço, estrutura (lista de materiais), custo, o que repor, o que falta para a carteira, os ajustes de contagem e as compras em andamento. **Conferido** no código (`almoxarifado.jsx` e arquivos irmãos), 01/11/2026.

**Fora do escopo:** o estoque de revenda importada e a sugestão de compra do varejo (7.9); fabricar (13); o app de contagem (repositório próprio).

### 12.1.2 Rota e arquivos
Rota `almoxarifado`; URL `/logistica/almoxarifado/<aba>`. Abas válidas (`useRouteTab`): `estoque` (padrão), `estrutura`, `custos`, `reposicao`, `necessidade`, `ajustes`, `pedidos`. A aba **Pedidos de compra** guarda o item aberto no 3º segmento (`useRotaItem`). **Ao criar aba nova, incluir na lista**, senão o link cai em Estoque. **Conferido.**

### 12.1.3 Perfil e acesso
Alçadas do módulo `almoxarifado` (contagem de pessoas, 01/11/2026, **Conferido** no banco): ver 10, criar 9, editar 9, **escrever_omie 4**, excluir 2, **ver_custo 2**, **custo_manual 2**, **reposicao_config 2**. A tela lê: `escrever_omie` (Estoque, Ajustes, janela de compra), `editar` (contar), `ver_custo` (colunas e totais de custo), `custo_manual` (aba Custos), `reposicao_config` (parâmetros da Reposição), e `pcp.criar` (Gerar OP na Necessidade). **Não verificado** se a página bloqueia quem não tem `almoxarifado.ver`; o item de menu não tem `restrict`.

### 12.1.4 O que a tela mostra
Cabeçalho com título e frase por aba, e sete botões. **Estoque:** uma linha por produto ativo do PCP com saldo, reservado, contado, diferença, endereço, custo (só com `ver_custo`), faltas de cadastro (filtros: Com diferença, Sem contagem, Zerados, Abaixo do mínimo do Omie, Com reservado, Sem custo, Sem endereço, Sem lead time, Sem vínculo no Omie). **Estrutura:** lista de materiais dos produtos (alterações gravadas no Omie). **Custos:** componentes sem custo para preencher o **custo manual**. **Reposição:** quanto comprar e quando, com tendência. **Necessidade:** o que falta para a carteira e até quando comprar. **Ajustes:** movimentos do livro-razão por situação. **Pedidos de compra:** compras do Omie, requisições do PCP e pedidos internos de varejo. **Conferido.**

### 12.1.5 Botões e controles
Estoque: contar, endereço (por produto e importação em massa), movimentar (Entrada/Saída/Acertar saldo, motivos INV/INI/PER), **Sincronizar estoque (Omie)** (chama `sync-estoque-omie`). Estrutura: editar estrutura (grava no Omie). Custos: salvar custo manual. Reposição: parâmetros, **Enviar compra ao Omie (N)**. Necessidade: **Gerar OP (N)**, **Enviar compra ao Omie (N)**, interruptor "incluir previsão (etapa 10)". Ajustes: **Confirmar / Descartar / Enviar ao Omie**. Pedidos de compra: atualizar (`sync-pcp-compras`), registrar pedido interno. **Conferido** (chamadas listadas em 12.1.7).

### 12.1.6 Comportamento
- **Custo, em ordem:** 1) custo médio do Omie (só existe com saldo); 2) custo pelas compras (média ponderada das recebidas nos últimos 12 meses, ou o preço do pedido pendente); 3) **custo manual** (estimativa do PCP, só vale quando as duas fontes não têm custo). **Conferido** (texto da tela).
- **Reposição por consumo, não por mínimo:** crítico = posição ≤ consumo/dia × prazo; comprar = posição ≤ consumo/dia × (prazo + folga); posição = disponível + a caminho. Prazo 90 d importado / 15 d nacional (código terminado em "n" minúsculo); folga 30 d; ciclo 60 d. **Herdado** (CLAUDE.md; valores editáveis na tela, não reconferidos).
- **Necessidade** usa o físico (não o disponível, para não contar a venda duas vezes), por nível de estrutura; **pedido em etapa 10 entra só como previsão**. **Herdado.**
- **Ajustes:** **Confirmar não envia**; o envio é um passo à parte, que simula, mostra o resumo e pede `confirm()`. **Conferido** (`ajustes-estoque.jsx`).
- Atualizações automáticas: Pedidos de compra a cada 60 s. **Conferido.**

### 12.1.7 Dados
**Lê:** `pcp_produtos` (187), `pcp_estoque` (176), `pcp_posicao_compra`, `pcp_compras_itens` (128), `pcp_consumo_mov` (4.169), `pcp_estrutura`, `pcp_pedidos`/`pcp_pedido_itens`/`pcp_pedido_acompanhamento`, `pcp_previsao_*`, `pcp_ordens`, `pcp_reposicao_config`, `pcp_sync_log`, `estoque_movimentos` (3), `importacao_varejo_contagem` e `_hist`, `alertas`. **Grava:** `importacao_varejo_contagem(_hist)` (contagem e endereço), `pcp_produtos` (custo manual, parâmetros de reposição), `pcp_reposicao_config`, `pcp_ordens` (+ materiais e etapas, via Gerar OP), `pcp_omie_fila` (6, fila de envio ao Omie). **Chama:** `pcp-omie-escrever` (escrita no Omie), `sync-estoque-omie`, `sync-pcp-consumo`, `sync-pcp-compras`, `sync-pcp-pedidos` e RPC `estoque_decidir_movimento`. **Conferido** (contagens por `count(*)`, 01/11/2026).

### 12.1.8 Regras e armadilhas
- **Regra de ouro (PC-4):** movimento por **venda/remessa não vai ao Omie**; consumo, perda e ajuste vão, com confirmação. **Herdado**; reconferido o efeito: dos 3 movimentos do livro-razão, 2 são `ajuste_contagem` **já enviados** ao Omie e 1 é `transferencia_expedicao` interna (não vai). **Conferido.**
- **Tabelas abertas à chave pública (achado, sem correção):** `pcp_produtos` e `pcp_estoque` têm leitura, inclusão e alteração para o papel `public`; `pcp_reposicao_config` aceita **UPDATE** de `anon`/`authenticated`; `pcp_omie_fila` e `importacao_varejo_contagem(_hist)` também são legíveis (a fila) e graváveis (contagem). Custo, parâmetros e contagem podem ser alterados por quem tiver a chave pública. **Conferido** (`pg_policies`). Ver PC-6.
- **Escrita no Omie por alçada de tela:** `almoxarifado.escrever_omie` é conferida no navegador; o envio real passa por `pcp-omie-escrever` (que também confere). **Herdado.**
- **O Omie bloqueia a API inteira por 30 min** após ~10 erros seguidos de "não encontrado"; nada aqui sonda item a item. **Herdado** (Art. 30).
- **Corrimão e cabo de manobra** têm custo manual de R$ 350/m em alguns itens, por decisão do Gelson (03/10/2026); o Omie assume quando tiver custo. **Herdado.**

### 12.1.9 Testes
Unitários: `reposicao-calc.test.js`, `necessidade-calc.test.js`, `pcp-pedido-sla.test.js`. A rota entra sozinha no teste de fumaça (`e2e/smoke.spec.js`). **Não existe** teste de unidade para `almoxarifado.jsx`, `ajustes-estoque.jsx` nem `compra-pcp.jsx` (listagem do diretório, **Conferido**). Cenários de aceitação:
- **Dado** uma contagem diferente do saldo, **quando** a contagem é gravada, **então** nasce um ajuste `pendente_confirmacao` (**Herdado**; o histórico tem 2 ajustes enviados).
- **Dado** um ajuste confirmado, **quando** a pessoa com `escrever_omie` envia, **então** a chave `MOV-…` impede lançar duas vezes (**Herdado**).

### 12.1.10 Pendências e decisões
- **Achado, sem correção:** abertura de tabelas ao público (12.1.8).
- **Divergência do CLAUDE.md:** a seção do estoque diz que o primeiro envio real de ajuste "ainda não foi feito"; o banco mostra 2 enviados. **Conferido.** Perguntar ao Gelson se foram os testes autorizados.
- **Não verificado:** o `CLAUDE.md` diz que o envio de ajuste **não** compara com ajustes que o Omie já tem (a baixa de produção compara); reconciliação item a item contra o saldo do Omie ainda não existe. **Herdado.**
- Em aberto desde 03/10: unificar Reposição (consumo) com a sugestão da Compras (venda) — decidir qual manda. **Herdado.**

### 12.1.11 Histórico
Nasceu com o PCP em out/2026; Estoque virou fonte única de contagem e endereço em 18/10/2026; sincronizador único `sync-estoque-omie` em 18/10/2026. Detalhe: Git e CLAUDE.md (seções PCP e Estoque). **Herdado.**

---

## 12.2 Expedição

### 12.2.1 O que é
O despacho e a entrega do que foi fabricado, depois da NF emitida no Omie. Só libera pedido **faturado**. **Conferido** em `expedicao.jsx` (370 linhas).

**Fora do escopo:** emitir a NF (5.4, no Omie); fabricar (13); etiqueta de volume (12.4).

### 12.2.2 Rota e arquivos
Rota `expedicao`; URL `/logistica/expedicao[/<codigo_pedido>]` — o pedido aberto vive na URL (`useRotaId`). Arquivo `expedicao.jsx`. **Conferido.**

### 12.2.3 Perfil e acesso
Alçada `expedicao` (ver 12, criar 11, editar 11, excluir 3). A tela lê só `expedicao.editar` (despachar, entregar, desfazer). **Conferido.**

### 12.2.4 O que a tela mostra
Fila de pedidos que ainda precisam de ação (o histórico, as etapas 00/10 e o que o Omie já deu como entregue ficam escondidos atrás do chip "Mostrar histórico e já entregues"), com prazo de despacho, avisos (NF emitida mas OP-mãe aberta), itens do pedido e, na janela do pedido, transportadora, volumes, rastreio e comprovante. **Conferido.**

### 12.2.5 Botões e controles
Atualizar do Omie (chama `sync-pcp-pedidos`), despachar, marcar entregue, editar rastreio/observação, anexar comprovante (canhoto), desfazer saída/entrega (motivo obrigatório, vai ao log). **Conferido.**

### 12.2.6 Comportamento
- **Prazo de despacho = 1 dia útil depois da NF** (`PcpPedidoSLA`); passou = atrasado.
- **Rastreio** segue editável até o pedido ser entregue.
- Nome da transportadora é **normalizado** (maiúsculas, sem espaço duplo, sem LTDA/ME) para não virar várias grafias.
- Atualiza a lista a cada 60 s. **Conferido.**

### 12.2.7 Dados
**Lê:** `pcp_pedidos` (291), `pcp_pedido_itens`, `pcp_ordens` (OP-mãe do pedido), `pcp_pedido_acompanhamento`. **Grava:** `pcp_expedicoes` (**0 linhas hoje**, upsert por `pedido_codigo`) e o bucket **privado** `expedicao-comprovantes` (URL assinada de 1 h; comprovantes antigos no bucket público `engenharia` continuam abrindo). **Conferido.**

### 12.2.8 Regras e armadilhas
- **Trava da NF no banco:** gatilho `fn_pcp_expedicao_exige_nf` — sem `faturado` (e não cancelado), despachar/entregar levanta erro, mesmo chamando a API direto. **Conferido** (a função existe; o texto da regra vem de **Herdado**).
- **Tabela aberta (achado, sem correção):** `pcp_expedicoes` tem SELECT, INSERT e UPDATE para `public`. A trava da NF protege o estado, mas transportadora, rastreio e comprovante podem ser gravados por quem tiver a chave pública. **Conferido** (`pg_policies`).
- **A expedição não baixa estoque no Omie** (a NF já baixou); a transferência interna origem→`EXP` é registrada no livro-razão como `interno`. **Herdado**; o movimento existe (1 linha, **Conferido**).
- **"Pronto p/ expedir" por item** (vindo da Separação, `separacao_destinos`) aparece na lista como selo; a tabela está vazia hoje. **Herdado** (spec de 26/10).
- Alerta diário `pcp-expedicao-alerta-sem-entrega`: despachado há 5+ dias úteis sem entrega. **Conferido** (cron ativo, 10:10 UTC seg–sex).

### 12.2.9 Testes
`pcp-pedido-sla.test.js` cobre o prazo; a rota entra no teste de fumaça. **Não existe** teste da tela nem da trava da NF no repositório (**Conferido**; a trava foi testada à mão em 03/10/2026, **Herdado**). Cenário: **Dado** pedido sem NF, **quando** se tenta despachar, **então** o banco recusa.

### 12.2.10 Pendências e decisões
- **Achado, sem correção:** `pcp_expedicoes` aberta à chave pública (12.2.8).
- Nenhuma expedição foi registrada ainda (0 linhas): o fluxo real **não foi exercitado em produção** com dado de verdade. **Conferido.**
- **Não verificado:** o tutorial da Expedição.

### 12.2.11 Histórico
Criada em 03/10/2026 junto com a Emissão de NF; selo de itens vindos da Separação em 26/10/2026. **Herdado.**

---

## 12.3 Separação

> **Atualização de 04/11/2026:** saiu o botão **Quadro de Comando** dos itens "Na operação" (a separação de pedido de quadro vive em `14_quadros_comando.md`, 14.2 e 14.3). Corrimão, Corte e Expedição seguem como estão. **Conferido** (código).

### 12.3.1 O que é
A fila dos pedidos de venda do Omie em **etapa 20** que o almoxarifado precisa separar, com a mesma regra do **celular**, mais o **painel de TV** público. **Conferido** em `separacao.jsx` e `separacao-tv.jsx`.

**Fora do escopo:** fabricar o que sai da separação (13, telas Fabricação Corrimão/Corte); etiqueta (12.4); o app do celular.

### 12.3.2 Rota e arquivos
Rota `separacao`; URL `/logistica/separacao/<aba>` com abas `pedidos` (padrão) e `tv`; pedido aberto em `/logistica/separacao/pedidos/<codigo_pedido>` (`useRotaItem`). Página pública: `/separacao-tv/<token>` (entregue por `server.js` sem login). **Conferido.**

### 12.3.3 Perfil e acesso
Alçada `separacao` (ver 6, editar 5, **enviar_fabricacao 2**) e, para separar, `estoque.saida` (6 pessoas). Ver a lista de links e o SLA exige `separacao.ver`; gerar/revogar link e mudar o SLA exigem `separacao.editar`; separar exige `estoque.saida`; enviar a Corrimão/Corte exige `separacao.enviar_fabricacao`. O banco **confere de novo** nas RPCs. **Conferido** (tela e contagens).

### 12.3.4 O que a tela mostra
**Pedidos a separar:** fila com cliente, quem pegou, SLA e estado (aguardando, em separação, **parcial**, separado); dentro do pedido, os itens com quantidade, endereço e as ações por item. Item "Na operação" mostra os botões **Quadro de Comando, Corrimão, Corte, Expedição** e a linha "onde está". **Painel TV:** gerar link, lista de links, SLA. Atualiza a cada 30 s. **Conferido.**

### 12.3.5 Botões e controles
Pegar, assumir, soltar, separar (quantidade + endereço), **pendenciar** (na operação / aguardando chegada / falta, com observação obrigatória), "Chegou", concluir, etiqueta AGUARDA, enviar a destino. TV: gerar, copiar, revogar, salvar SLA. **Conferido** (RPCs em 12.3.7).

### 12.3.6 Comportamento
- **Parcial é calculado**, não é valor da coluna `status`: separação em andamento com ao menos uma pendência aberta e nenhum item sem separar e sem justificativa. Só `separado` conta como pronto; o relógio do SLA para em separado/parcial. **Herdado** (spec 20/10); estados de hoje: 13 `em_separacao`, 1 `separado`, 17 pendências (**Conferido**).
- Concluir recusa se houver item na operação ou aguardando chegada. **Herdado.**
- **O operador decide** o que é fabricado ou pendente; a etiqueta "Fabricado pelo PCP" (`item_pcp`) é só dica. **Herdado.**
- **Quadro de Comando e Expedição só registram o destino** (`separacao_destinos`, 0 linhas hoje); Corrimão e Corte criam OP-unidade. **Herdado**; o botão existe no código (**Conferido**).

### 12.3.7 Dados
**RPCs (só `authenticated`, Conferido):** `separacao_hub` (lê e escreve, chama `estoque_separacao_chamar`), `separacao_enviar_fabricacao`, `separacao_enviar_destino`, `separacao_destinos_listar`, `separacao_tipos`, `separacao_tv_listar/gerar/revogar/config_salvar`. **Pública (anon, por token):** `separacao_tv_dados`. **Tabelas:** `estoque_separacoes` (14), `estoque_separacao_pendencias` (17), `estoque_separacao_hist` (imutável), `separacao_destinos` (0), `pcp_pedidos`/`pcp_pedido_itens` (leitura). `estoque_separacao_chamar` **não** é executável por `anon` nem `authenticated` (Conferido): só as RPCs a chamam.

### 12.3.8 Regras e armadilhas
- **Fila compartilhada com o celular:** o hub grava pela **mesma** função do celular. **Não altere `estoque_separacao_chamar` por causa desta tela.** O celular ainda **não vê** pendências e observações do hub (para ele a pendência é "falta"). **Herdado.**
- **O link da TV é a senha:** quem o tiver vê pedido, status, SLA e códigos de produto (sem cliente, valor ou nome de pessoa). Revogue se vazar. **Herdado**; a RPC pública existe (**Conferido**).
- **SLA 4 h úteis** é escolha da implementação, editável na aba Painel TV. **Herdado.**
- Concluir a separação não baixa estoque nem escreve no Omie (a NF baixa). **Herdado.**
- **Aviso automático** quando a OP-mãe de um pedido com pendência conclui, e aviso de pedido novo na etapa 20 (gatilhos). **Herdado**, não reconferi o corpo dos gatilhos.

### 12.3.9 Testes
A página da TV entra no teste de fumaça (`/separacao-tv/e2e-token`, **Conferido**). **Não existe** teste unitário da Separação nem e2e dos cliques (**Conferido**). O `CLAUDE.md` registra que pendenciar, resolver, concluir e as etiquetas AGUARDA **nunca foram exercitados com dado real** na época (**Herdado**); hoje há 17 pendências, o que mostra uso, mas não prova cobertura. Cenário: **Dado** pedido com item na operação, **quando** se tenta concluir, **então** a conclusão é recusada.

### 12.3.10 Pendências e decisões
- O celular precisa enxergar pendências (app `013_Estoque`). **Herdado.**
- Previsão de chegada do embarque no item "aguardando chegada" não foi feita (a função `estoque_separacao_chegadas` existe). **Herdado.**
- Dois documentos de 21/10 (`DIAGNOSTICO_/PLANO_separacao_envio_producao`, issue #1027) descrevem outro desenho (destino por **tipo do item**); **não** foi o implementado. Perguntar ao Gelson se arquivam. **Herdado**, não localizei os arquivos nesta sessão.

### 12.3.11 Histórico
Aba Pedidos a separar e pendências: 20/10/2026; envio a Corrimão/Corte: 22/10/2026; quatro destinos: 26/10/2026. **Herdado.**

---

## 12.4 Etiquetas

### 12.4.1 O que é
Gera e imprime etiquetas (endereço, item, prateleira/rua, recebimento, separação, expedição, chicote do quadro, OP de quadro e de fabricação, avaria, palete, ID-TAG) em impressora térmica **Zebra** (ZPL) ou pelo diálogo do navegador, com **histórico imutável** de impressões. **Conferido** em `etiquetas.jsx` e arquivos irmãos.

**Fora do escopo:** o app de estoque lê os QR (contrato, PC-2); o ciclo de vida do palete não existe.

### 12.4.2 Rota e arquivos
Rota `etiquetas`; URL `/logistica/etiquetas/<aba>`; abas `gerar` (padrão, com o tipo no 3º segmento), `modelos` (modelo em edição no 3º segmento), `historico`. **Conferido.**

### 12.4.3 Perfil e acesso
Alçada `etiquetas` (ver 11, imprimir 11, reimprimir 11, editar_modelos 2, administrar 2). A tela lê `ver`, `imprimir`, `reimprimir` e `editar_modelos`; o banco confere `imprimir` (e `reimprimir` com motivo) no INSERT do histórico. **Conferido.**

### 12.4.4 O que a tela mostra
Gerar: escolha do tipo, dados do item/pedido/P.I./OP, rolo (largura, altura, colunas, espaço) e prévia. Modelos: modelos padrão e da empresa, com editor visual. Histórico: impressões feitas. **Conferido.**

### 12.4.5 Botões e controles
Imprimir (Zebra Browser Print ou navegador), etiqueta de teste, escolha de impressora/perfil, ajuste fino de posição, reimprimir (motivo ≥ 5 letras), copiar modelo e editar no editor visual. **Conferido** (nomes no código).

### 12.4.6 Comportamento
- **QR e Code 128 sempre nativos da impressora**; endereço `END:R2A4`, item = o `codigo`, pedido `PED:<nº>`, posição `POS:`, rua `RUA:`, palete `PAL:`, equipamento `EQP:`, OP `OP:`. **Herdado** (spec e issue #862).
- Modelo cujo tamanho não bate é **adaptado** (escala única, centralizado); sem modelo próprio de tamanho, avisa a escala. Máximo de 500 etiquetas por impressão, em lotes de 100. **Herdado.**
- Expedição imprime **como imagem** (`^GFA`), por causa do giro de 90°. **Herdado.**
- **OP / série do quadro: padrão 100 × 100 mm** (`OP_QUADRO_100x100`, pedido do Gelson em 03/11/2026); o `OP_QUADRO_100x50` continua disponível. Sem rolo lembrado para o tipo, a tela começa em 100 × 100 (`ETQ_ROLO_PADRAO` em `etiquetas.jsx`); rolo já lembrado vence (botão "Esquecer"). O campo da OP ocupa a largura toda (no 100 × 50 uma OP longa, ex. com sufixo de quadro, saía como "OP…"). **Conferido** (código e teste unitário em 03/11/2026); **Não verificado** na impressora física.
- Endereço digitado à mão (Almoxarifado, Compras) é conferido pela regra do galpão; valor igual ao já gravado passa. **Herdado.**

### 12.4.7 Dados
**Lê:** `estoque_enderecos` (237), `pcp_produtos`, `pi_importacao`, `embarques_importacao`, `pcp_pedidos`, `quadros_comando`, `pcp_ordens`, `mes_ordens`. **Grava:** `etiqueta_impressoes` (118; **só INSERT e SELECT**, sem UPDATE nem DELETE) e `etiqueta_modelos` (0 linhas; INSERT/UPDATE/DELETE por `authenticated`). Tipos impressos até hoje: PRATELEIRA 29, EXPEDICAO 28, CHICOTE_QUADRO 25, ENDERECO 20, SEPARACAO 6, ITEM 4, OP_QUADRO 3, TESTE 2, FABRICACAO_OP 1. **Conferido** (01/11/2026).

### 12.4.8 Regras e armadilhas
- **Formato de QR novo exige comentário na issue #862 antes de mudar** (o app de estoque lê). **Herdado.**
- **DV do endereço** (fórmula proposta, desligada por padrão) **não foi aprovada**; aprovar antes de imprimir as 236 etiquetas. **Herdado.**
- **Perfil de impressora é lembrado por aparelho** (o Browser Print só informa um código); perfil genérico = 203 dpi e encolhe tudo numa impressora de 300 dpi. **Herdado.**
- **Protegido no modelo da empresa:** o QR e o Code 128 do modelo padrão não saem nem mudam de conteúdo (`validarModelo`). **Herdado.**
- **Escolha de impressora automática** só vale até aparecer uma real; escolha manual nunca é trocada. **Herdado.**
- Erro já pago: `a || b && c ? x : y` sem parênteses derrubou a tela (modelo nulo); testes de cálculo e compilação do JSX **não** pegam isso — tela de Etiquetas nova se abre de verdade antes do merge. **Herdado.**

### 12.4.9 Testes
`etiquetas-calc.test.js`, `etiquetas-impressoras.test.js`, `etiquetas-config-tipo.test.js`, `etiquetas-store-chicote.test.js`, `e2e/etiquetas.spec.js` (com um Browser Print de mentira na porta 9100; rodam em sequência). **Conferido** (arquivos existem; contagem de testes não reconferida). **Não testado** na impressora Zebra física para todos os tipos (**Herdado**; o histórico mostra impressões reais de 9 tipos).

### 12.4.10 Pendências e decisões
- Bancada na impressora para todos os tipos; decidir o DV do endereço. **Herdado.**
- Renderizador PPLZ da Argox não existe (só diálogo do navegador). **Herdado.**
- Ciclo de vida do **palete** (nasce na importação, desfaz no pedido) não existe: só a etiqueta. **Herdado.**
- O app de estoque deve recusar endereço inexistente na contagem/recebimento/saída e, se quiser, ler os prefixos novos. **Herdado.**
- Nenhum modelo da empresa foi criado (0 linhas). **Conferido.**

### 12.4.11 Histórico
Fase 1 em 17/10/2026; fases 2–4 (recebimento, separação, palete, ID-TAG, OP, avaria, editor visual) em 17–18/10; prateleira/rua em 27/10; rolo personalizado e colunas em 19/10. **Herdado.**

---

# Parte comum de Logística Interna

## PC-1 Mapa de ligações
**Herda de:** Omie (saldo 4x/dia, pedidos de venda, compras, movimentos), 7.9 Compras (mesma contagem), 5.4 Emissão de NF (faturado), 13 PCP/Fabricação (pedidos, OPs, estrutura), app `013_Estoque`. **Doa para:** Omie (ajuste de estoque, requisição de compra), 13 (OP-unidade de Corrimão/Corte, pedido de quadro), Central de Notificações (alertas), Expedição (destino da Separação). **Selo:** Herdado, exceto onde a tela já foi citada como Conferida.

## PC-2 O estoque de ponta a ponta
Venda no Omie (etapa 20) → Separação (hub ou celular) → itens que precisam de fabricação vão para Corrimão/Corte/Quadro (13) → fabricado → NF emitida (5.4) → Expedição → entrega. Em paralelo: contagem (Almoxarifado, Compras ou celular) grava na **mesma** tabela; diferença vira ajuste; ajuste confirmado pode ir ao Omie. **Contrato com o app de contagem (não renomear):** `importacao_varejo_contagem`/`_hist` (código em MAIÚSCULAS), `estoque_eventos` (insert-only), `estoque_sessoes`, e as funções `estoque_registrar_eventos`, `estoque_*` chamadas pelas Edge Functions `estoque-eventos` e `estoque-revisao`. **Herdado.**

## PC-3 Rotas, páginas públicas e arquivos
`/logistica/almoxarifado[/aba[/item]]`, `/logistica/expedicao[/<pedido>]`, `/logistica/separacao[/aba[/<pedido>]]`, `/logistica/etiquetas[/aba[/item]]`; pública: `/separacao-tv/<token>` (**Conferido** em `server.js` e no teste de fumaça). As telas de Fabricação Corrimão/Corte também usam uma página pública por token, mas são do 13.

## PC-4 A regra de ouro do Omie e os "estoques" que existem
- **Venda/remessa não vai ao Omie** (a NF baixa lá); **consumo de produção, perda e ajuste de contagem vão**, com confirmação manual por item no começo. **Herdado.**
- **Dois universos de estoque** (Almoxarifado ~176 itens do PCP × Compras ~1.700 itens de revenda) lidos do **mesmo** sincronizador (`sync-estoque-omie`, 7h/11h/15h/19h BRT), 33 itens em ambos. **Herdado.**
- **Quatro "números" de saldo não se confundem:** saldo do Omie, contado, disponível (físico − reservado) e "a caminho" (o que falta chegar nos pedidos de compra, **não** o `nPendente` do Omie, que é de pedidos de venda). **Herdado.**
- **Escrita no Omie:** a baixa de produção do quadro, a compra e o ajuste escrevem por `pcp-omie-escrever`; a escrita real exige autorização do Gelson no momento (Art. 30). **Herdado.**

## PC-5 Quem faz o quê (alçadas)
Resumo **Conferido** (contagens de pessoas, 01/11/2026): `almoxarifado` — escrever_omie 4, ver_custo 2, custo_manual 2, reposicao_config 2; `estoque` (celular/revisão) — contar 6, receber 6, saída 6, abrir_sessão 4, revisar 3, aprovar 3; `separacao` — ver 6, editar 5, enviar_fabricacao 2; `expedicao` — editar 11; `etiquetas` — imprimir 11, editar_modelos 2. Administrador passa sempre. O módulo `estoque` **ainda** não aparece no catálogo de alçadas do front (**Herdado**; não reconferi).

## PC-6 Identidade, alçadas e segurança
O app usa a chave pública; trava de tela é organização (Art. 25; #571). **Conferido hoje (`pg_policies`):**
| Tabela | Política |
|---|---|
| `pcp_produtos`, `pcp_estoque` | SELECT, INSERT, UPDATE para `public` |
| `pcp_expedicoes`, `pcp_pedido_acompanhamento` | SELECT, INSERT, UPDATE para `public` |
| `pcp_reposicao_config` | SELECT e UPDATE para anon/authenticated |
| `importacao_varejo_contagem` | SELECT, INSERT, UPDATE para `public` (`_hist`: SELECT, INSERT) |
| `pcp_pedidos`, `pcp_pedido_itens`, `pcp_omie_fila` | SELECT para `public` |
| `pcp_compras_itens`, `pcp_consumo_mov` | SELECT para anon/authenticated |
| `estoque_enderecos` | só `authenticated` (ALL) |
| `estoque_movimentos`, `estoque_eventos` | SELECT `authenticated` |
| `estoque_sessoes` | SELECT anon/authenticated (**colunas seguras**, Herdado) |
| `etiqueta_impressoes` | INSERT e SELECT `authenticated` (imutável) |
| `etiqueta_modelos` | CRUD `authenticated` |
As tabelas novas de Separação e do livro-razão nasceram **fechadas**. As antigas do PCP seguem abertas (**achado, sem correção**).

## PC-7 Gatilhos, eventos, crons e funções
**Crons ativos (Conferido, UTC):** `sync-estoque-omie-4x-dia` (10/14/18/22h), `sync-pcp-omie-4x-dia` e `-estrutura-4x-dia`, `sync-pcp-pedidos-etapa20` (:00/:30), `-abertos` (:10/:40), `-previsao-etapa10` (:20), `pcp-pedidos-tirar-etapa10` (hora em hora, :20), `sync-pcp-compras-diario` 09:40, `sync-pcp-consumo-recente` 04:30, `pcp-alerta-compras-diario` 10:00, `pcp-alerta-prazos-diario` 10:05, `pcp-expedicao-alerta-sem-entrega` 10:10, `pcp-compras-alerta-atrasos` 10:20, `pcp-varejo-alerta-parados` 10:30, `estoque-reconciliacao-diaria` 10:35, `estoque-omie-endereco-sync` (**a cada minuto**), `pcp-carga-semanal-1/2/3` (domingo). **Não reconferi** o corpo de `estoque-omie-endereco-sync` nem das cargas semanais. Funções de borda: `sync-estoque-omie`, `pcp-omie-escrever`, `sync-pcp-pedidos`, `sync-pcp-consumo`, `sync-pcp-compras`, `alerta-pcp-compras` (**Herdado**; lista de funções não reconsultada).

## PC-8 Tabelas
`pcp_*` (produtos, estoque, estrutura, posição de compra, compras, consumo, pedidos, itens, expedições, fila Omie, reposição), `estoque_*` (separações, pendências, histórico, sessões, eventos, movimentos, endereços), `separacao_destinos`, `separacao_tv_*`, `importacao_varejo_contagem(_hist)`, `etiqueta_impressoes`, `etiqueta_modelos`. Contagens em 12.x.7.

## PC-9 Navegação, cache e testes
Aba na URL (`useRouteTab`) e item na URL (`useRotaItem`/`useRotaId`) em todas as telas; abas novas entram na lista de válidas e `node scripts/gerar-mapa-rotas.js` atualiza `docs/MAPA_DE_ROTAS.md`. Testes em cada tela (12.x.9). Cache-busting `?v=` obrigatório (Art. 19).

## PC-10 Menu "?" e tutoriais
**Não verificado** quais tutoriais cobrem Almoxarifado, Separação, Expedição e Etiquetas e se estão atualizados; o `CLAUDE.md` registra o da Separação como desatualizado. Tutorial passa pela sessão de tutoriais (Art. 46).

## PC-11 Documentos soltos e destino do que foi concatenado
Seções do `CLAUDE.md` que tratam do módulo e agora têm destino aqui (substituição por ponteiro depende da confirmação do Gelson, Art. 13): PCP — Almoxarifado/Reposição/Necessidade/alertas/Ajustes (parte de estoque), "Estoque — organização, menu Fabricação, carga única e sincronizador único" (fases 1–6), "Separação no hub", "Etiquetas (fases 1–4, rolo, prateleira, ZT230, Expedição como imagem, chicote)", "PCP › Pedidos para Produzir" (fila → **13**), "Fabricação Corrimão/Corte" (→ **13**). Specs: `docs/superpowers/specs/2026-10-17-modulo-etiquetas-design.md` (Etiquetas, mantida como histórico) e `2026-10-26-separacao-distribuicao/` (Separação, histórico). **Histórico fica onde está; nada foi apagado.**

## PC-12 Benefícios trocados com os outros módulos

- **Recebido de Quadros de Comando (04/11/2026, texto em `14_quadros_comando.md` PC-12, Art. 49):** (a) o Omie repete a linha do item com **quantidade 0** — somar por código e ignorar o zero antes de contar linhas ou unidades; (b) **metro e peça nunca se somam** — total por unidade de medida; (c) a caixa de uma tabela longa deve ter a **altura da janela**, para a barra de rolagem lateral ficar à vista; (d) função de banco nova se testa **numa transação que se desfaz**, incluindo um usuário ativo **sem** a alçada (a recusa por "sem sessão" não prova a trava de alçada); (e) a **observação do item** do pedido do Omie (`pcp_pedido_itens.obs_item`) guarda o que a proposta mostra dentro do item. **Conferido** (04/11/2026).
**Recebidos:** de Parceiros & Instaladores — status gravado precisa de recálculo; portão de aprovação falha fechado; dado pessoal fora do repositório. **Doados** (texto nos documentos de 1 a 11, linha "Recebido de Logística Interna"): ver cada módulo.
- **Recebido de Fabricação (01/11/2026, texto em `13_fabricacao.md` PC-12):** a OP-mãe concluída (13.1) libera a Emissão de NF e a Expedição; o PCP gera OP a partir da Necessidade (12.1) e o item "Na operação" da Separação vira OP de Corrimão/Corte (13.9/13.10). **Conferido** no código.
- **Recebido de Administração (01/11/2026, texto em `15_administracao.md` PC-12):** o log de auditoria (`vp_logs`) usado por todas as telas é legível e gravável pela chave pública (14.1.8); logs de ajuste de estoque e de despacho não são prova sem essa ressalva. **Conferido.**
- **Recebido de Serviços (01/11/2026, texto em `16_servicos.md` PC-2):** todo alerta com destinatário também vira WhatsApp pelo gi-avisos; para chegar certo, título curto com o essencial na frente, sem "teste", sem R$ no título e com o dia da semana por extenso, a obra ou o código do contrato quando houver vários no mesmo dia (o agrupamento de 24 h apaga números). **Conferido** no código do gi-avisos.
