# 13 Fabricação — documento do módulo (REAL, fonte da verdade — 01/11/2026)

> **Status: REAL (documento oficial do módulo 13), aprovado pelo Gelson em 01/11/2026**, no molde de `01_geral.md` a `12_logistica_interna.md`. Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que este módulo pede cuidado:** é onde o pedido vendido vira **ordem de produção (OP)** e onde o chão de fábrica registra o que foi feito. Quatro coisas pedem atenção: (1) **quase todas as tabelas do PCP e do MES estão abertas à chave pública** do banco, e as do "Evolução da Fabricação do Quadro" também, **inclusive os tokens dos links do chão de fábrica** (PC-6); (2) existem **três jeitos** de acompanhar a execução — o MES (kanban por etapa), a Evolução do Quadro (6 etapas por link) e Corrimão/Corte (RPC por token) — com desenhos de segurança diferentes (PC-2); (3) o **custo** de material e a **hora-homem** têm regra própria de quem pode ver (PC-5); (4) a OP-mãe de um pedido é a ligação com Emissão de NF e Expedição (12); errar o vínculo com o pedido do Omie esconde o pedido dessas telas.
>
> **Fonte da verdade:** o código e o banco, conferidos em 01/11/2026 (`origin/main` `df8b84e`). **Conferido** = lido no código ou consultado no banco (só SELECT) nesta data; **Herdado** = veio do `CLAUDE.md`, de spec/migration ou do documento de outro módulo e **não** foi reconferido; **Não verificado** = não consegui confirmar. Sem selo vale como Não verificado (Art. 6).
>
> **Escopo do módulo:** as **doze** telas do grupo "Fabricação" do menu (`NAV_GROUPS` em `shell.jsx`, nesta ordem): **PCP**, **MES**, **MES · Cadastros**, **Carga Máquina**, **Matérias-Primas**, **Produtos**, **Montagem do Produto**, **Evolução da Fabricação**, **Fabricação Corrimão**, **Fabricação Corte**, **Simulação** e **Relatórios**. Pertencem a elas, sem item de menu: a **Lista de fios** (`/logistica/montagem-produto/lista-de-fios`) e as páginas públicas `/fabricacao-quadro/<token>` e `/fabricacao-oficina/<token>`. **Não** são deste módulo: Almoxarifado, Separação, Expedição e Etiquetas (12); Emissão de NF (5.4); o **Formulário do Quadro de Comando** (4.4, que alimenta o PCP); a **Compras** do varejo (7.9).
>
> **Onde moram arquivos que não têm nome óbvio (Conferido):** as rotas ainda são `/logistica/<rota>` (só o menu foi reagrupado); `Matérias-Primas` e `Produtos` são `cadastro-itens.jsx` (as duas telas no mesmo arquivo, rotas `cadastro-materias-primas` e `cadastro-produtos`, URLs `/cadastros/...`); os painéis dos Relatórios do PCP são `painel-producao-pcp.jsx`, `painel-perdas-pcp.jsx`, `painel-fluxo-pcp.jsx`, `painel-fotos-pcp.jsx`, `relatorios-pcp-extras.jsx` e `relatorios-pcp-custos.jsx`; Corrimão e Corte são **a mesma tela** (`fabricacao-oficina.jsx`, `FO_DESTINOS`) com dados de `fab_*`; a Evolução do Quadro usa `fabricacao_quadro_*` (outro desenho, mais antigo). O cabeçalho de vários arquivos ainda diz "Logística Interna" (comentário desatualizado).

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md`. Aqui vale a mesma: módulo = **13**; telas filhas = **13.1 a 13.12**, na ordem do menu; o conteúdo comum fica na **Parte comum**, sem número de tela.
- **Tudo o que é aba, janela ou página pública de uma tela pertence a ela.** Por exemplo, as cinco abas do PCP estão no 13.1 e a Lista de fios está no 13.7.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
13. **Fabricação**
   13.1 PCP (Ordens de Produção, Pedidos para Produzir, Pedidos de Quadro, Planejamento, Controle) · 13.2 MES · 13.3 MES · Cadastros · 13.4 Carga Máquina · 13.5 Matérias-Primas · 13.6 Produtos · 13.7 Montagem do Produto (e Lista de fios) · 13.8 Evolução da Fabricação · 13.9 Fabricação Corrimão · 13.10 Fabricação Corte · 13.11 Simulação · 13.12 Relatórios
   &nbsp;&nbsp;&nbsp;Cada tela tem os temas: x.1 O que é · x.2 Rota e arquivos · x.3 Perfil e acesso · x.4 O que a tela mostra · x.5 Botões e controles · x.6 Comportamento · x.7 Dados (lê/grava) · x.8 Regras e armadilhas · x.9 Testes · x.10 Pendências e decisões · x.11 Histórico
   Parte comum de Fabricação (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 Do pedido à fábrica: os três acompanhamentos · PC-3 Rotas, páginas públicas e arquivos · PC-4 Regras de negócio que atravessam as telas · PC-5 Quem faz o quê (alçadas, custo, hora-homem) · PC-6 Identidade, alçadas e segurança · PC-7 Gatilhos, eventos, crons e funções · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
14. Quadros de Comando → `14_quadros_comando.md` (REAL)
15. Administração → `15_administracao.md` (REAL)

## Glossário (módulo Fabricação)
Termos gerais (alçada, soft-delete, evento de fluxo) estão em `01_geral.md`; **Almoxarifado, Separação, Expedição** em `12_logistica_interna.md`. Não se repetem aqui.
- **OP (ordem de produção):** linha de `pcp_ordens`. A **frente** diz o tipo: `pedido` (OP-mãe do pedido de venda), `quadro`, `fiacao`, `botoeiras`, `cabos_aco`, `corrimao`, `corte`.
- **OP-mãe:** a OP `frente = 'pedido'` ligada ao pedido do Omie (`pedido_codigo`). É por ela que Emissão de NF, Expedição e Painel encontram o pedido. Só conclui quando todas as frentes concluem.
- **Frente:** uma OP-filha de um tipo de trabalho do mesmo pedido.
- **Pedido de Quadro:** o registro `quadros_comando` (vindo do Formulário do Quadro de Comando, 4.4) que o PCP usa para gerar OP-mãe + frentes. O nº "Pedido" dele é uma **sequência interna**, **não** o nº do Omie.
- **Pedido para Produzir:** pedido de venda do Omie em etapa 20 com ao menos um item do PCP.
- **BOM / estrutura:** lista de materiais (`pcp_estrutura`), vinda do Omie; linhas criadas no PCP têm `origem = 'pcp'`.
- **Variante de quadro:** potência × tensão → produto do Omie (`pcp_quadro_variante`, 6 linhas).
- **MES:** acompanhamento da OP de quadro por etapa, com checklist obrigatório (`mes_*`). **Evolução do Quadro:** 6 etapas fixas flegadas por link público (`fabricacao_quadro_*`). **Oficina:** Corrimão e Corte, etapas por link (`fab_*`).
- **Matéria-prima:** item de código `VPMP…` (só consumido). **Produto:** todo o resto, com papel *Fabricado* (tem estrutura) ou *Mercadoria de estoque*.
- **Hora-homem (HH):** custo da hora de uma pessoa, calculado do Contas a Pagar do Omie; só sai por Edge Function para quem tem `pcp.ver_hh`.
- **Custo efetivo:** custo do Omie; senão o manual (estimativa do PCP). Ver 12.1.6.

---

## 13.1 PCP

> **Atualização de 04/11/2026 (Quadros de Comando, `14_quadros_comando.md`, PC-1):** saíram desta tela a aba **Pedidos de Quadro** e o botão **Enviar para Pedidos de Quadro** (criavam `quadros_comando` redundantes; o código da aba foi mantido, desligado). O **Gerar OPs** do pedido **continua** e é hoje o único jeito de criar a OP de quadro. O que este documento diz abaixo sobre a aba, o botão e a coluna "Pedidos de Quadro" da lista de itens vale **até esta data**. **Conferido** (código).

### 13.1.1 O que é
O centro do planejamento: lista as **OPs**, mostra os **pedidos do Omie que precisam de produção**, transforma **pedidos de quadro** em OP-mãe + frentes, planeja por produto e controla a execução. **Conferido** em `pcp.jsx` (1.700 linhas).

**Fora do escopo:** executar etapa a etapa de um quadro (13.2); estoque e compra (12.1); emitir NF (5.4).

### 13.1.2 Rota e arquivos
Rota `pcp`; URL `/logistica/pcp/<aba>[/<id da OP>]`. Abas válidas (`useRouteTab`): `ordens` (padrão), `fila`, `pedidos`, `planejamento`, `controle`; a OP aberta fica no 3º segmento (`useRotaItem`, também abre a OP a partir de outras telas, gravando com `replace`). **Conferido.** Arquivo `pcp.jsx`; ajuda em `pcp-etapas-omie.js` e `pcp-pedido-sla.js`.

### 13.1.3 Perfil e acesso
Módulo de alçada `pcp` (**ver 11, criar 7, editar 7, excluir 3, apontar_hh 7, ver_hh 3**, 01/11/2026, Conferido). `pcp.criar` habilita criar OP; `pcp.apontar_hh` escolher quem e quantas horas; `pcp.ver_hh` ver valor da hora e custo; `almoxarifado.escrever_omie` a baixa no Omie. **Não verificado** se a página barra quem não tem `pcp.ver`.

### 13.1.4 O que a tela mostra
- **Ordens de Produção:** lista e detalhe da OP (etapas, materiais com checklist, apontamentos, perdas e causa, ação corretiva, painel "Baixa no estoque do Omie").
- **Pedidos para Produzir (`fila`):** pedidos da etapa 20 com item do PCP; expandir mostra todos os itens e o botão **Enviar para Pedidos de Quadro** nos itens que são quadro.
- **Pedidos de Quadro (`pedidos`):** os `quadros_comando` aguardando OP, com o botão **Gerar OPs** e o seletor "Pedido de venda do Omie".
- **Planejamento (`pcp_plano`):** quantidade planejada por produto e mês. **Controle:** acompanhamento das OPs. **Conferido** (componentes `PCPFilaProducao`, `PCPPedidosQuadro`, `PCPPlanejamento`, `PCPControle`).

### 13.1.5 Botões e controles
Nova OP, Gerar OPs (a partir de pedido do Omie ou de pedido de quadro), enviar item ao Pedido de Quadro, apontar horas (HH), concluir OP, preparar e lançar baixa no Omie, sincronizar pedidos. **Conferido** (chamadas listadas em 13.1.7).

### 13.1.6 Comportamento
- **Gerar OPs do pedido do Omie:** cria a OP-mãe (`frente 'pedido'`, `pedido_codigo`, checklist de separação dos itens que não são do PCP) e uma OP por quadro (`-Q`, estrutura do Omie × quantidade) ou por corte (`-C`, em metros). Corrimão vira OP-unidade `corrimao`, classificado pela **família** (`/CORRIM/i`), não por "ter estrutura". **Herdado**.
- **Gerar OPs de um Pedido de Quadro:** OP-mãe + frentes `-Q` quadro, `-F` fiação, `-B` botoeiras, `-C` cabos de aço; "Reutilizar/Terceiro/Não se aplica" tira o item. O vínculo com o pedido do Omie é **escolhido na hora de gerar** e **não pode ser feito depois** numa OP-mãe já criada. **Herdado**.
- **Baixa de produção no Omie:** só OP com produto acabado (quadro); **comparar com o Omie antes de lançar** (igual → não mexe; divergente → o operador escolhe; novo → lança), chave determinística por OP+código+tipo; OP de corte e OP-mãe **não** movimentam. **Herdado**.
- OP sem `produto` é **ignorada** por Planejamento, Controle, Carga Máquina e relatórios de Produção/Perdas (`.not('produto','is',null)`): mantenha esse filtro em qualquer consulta nova. **Herdado**.
- O gatilho `trg_pcp_ordens_raiz_pedido` preenche `numero_pedido_omie` e `itens_pedido` de toda OP criada com `pedido_codigo`. **Herdado** (a função `pcp_ordens_raiz_pedido` existe, Conferido).

### 13.1.7 Dados
**Lê/grava:** `pcp_ordens` (71: corte 24, pedido 23, quadro 24), `pcp_ordem_etapas` (117), `pcp_ordem_materiais` (998), `pcp_ordem_checklist`, `pcp_plano`, `pcp_hh_apontamentos` (só leitura aberta; **quem grava é a função `pcp-hh`**), `pcp_etapas_modelo` (5). **Lê:** `pcp_pedidos`, `pcp_pedido_itens`, `pcp_estrutura` (632), `pcp_produtos`, `pcp_estoque`, `pcp_quadro_variante` (6), `quadros_comando` e suas tabelas (BOM, máquina, paradas, trechos de corte), `clientes`, `colaboradores_vpsistema`. **Chama:** `pcp-omie-escrever` (baixa), `pcp-hh` (hora-homem), `sync-pcp-pedidos`, `sync-pcp-os`. **Conferido** (contagens por `count(*)`).

### 13.1.8 Regras e armadilhas
- **Tabelas abertas (achado, sem correção):** `pcp_ordens`, `pcp_ordem_etapas`, `pcp_ordem_materiais`, `pcp_ordem_checklist`, `pcp_produtos`, `pcp_estoque`, `pcp_recursos` têm SELECT/INSERT/UPDATE para `public`; `pcp_estrutura`, `pcp_plano` e `pcp_roteiro` também permitem **DELETE**. Quem tem a chave pública altera OP, estrutura e planejamento. **Conferido** (`pg_policies`).
- **Pedido do Omie × pedido de quadro:** o "Pedido" do quadro é sequência interna; sem escolher o pedido do Omie, a OP-mãe nasce **sem raiz** e some da Emissão de NF e da Expedição. A tela pede confirmação nesse caso. **Herdado**.
- **Gerar OPs pelos dois caminhos duplica** o conjunto de OPs de um pedido (o aviso só cobre pedido não escolhido). **Herdado**.
- **Hora-homem:** o valor sai só pela função `pcp-hh` (ação `custos`) para quem tem `ver_hh`; as tabelas `pcp_hh_*` de valor têm RLS sem política; **nunca** logar salário. Fator de encargos = 1 (sem encargos) por decisão pendente do Financeiro. **Herdado**.
- **Custo da OP** usa o custo efetivo (12.1.6); componente sem custo bloqueia a baixa até informar valor. **Herdado**.
- **Sem baixa na tela de fabricação:** a produção "concluída" no MES conclui a OP no PCP (13.2.6), mas **perda** não é registrada pelo MES. **Herdado**.

### 13.1.9 Testes
Unitários: `pcp-pedido-sla.test.js`, `fiacao-quadro-engine.test.js`, `quadro-comando-*.test.js` (motor de BOM), `alerta-pcp-paridade.test.js`. A rota entra no teste de fumaça. **Não existe** teste de unidade nem e2e de `pcp.jsx` (Gerar OPs, baixa, HH) — **Conferido** (listagem). Cenário: **Dado** um pedido em etapa 20 com um quadro, **quando** Gerar OPs, **então** nasce a OP-mãe e uma OP `-Q` com a estrutura do Omie (**Herdado**, testado à mão em 03/10/2026 com o pedido 28244, dado depois apagado).

### 13.1.10 Pendências e decisões
- **Achado, sem correção:** abertura das tabelas (13.1.8).
- **Sem vínculo depois:** não há como ligar um Pedido de Quadro a uma OP-mãe já criada; precisaria editar `pedido_codigo`. **Herdado**.
- **Baixa de produção no Omie** por corrimão e cabo de manobra por clique do almoxarife: combinada, sem código. **Herdado**.
- Código/estrutura do cabo de manobra trabalhado e da calha cortada: o Gelson cria no Omie. **Herdado**.
- `perda_pct` da estrutura não é usado em nenhuma linha. **Herdado**.

### 13.1.11 Histórico
Módulo completo em 02–03/10/2026; fila → Emissão de NF → Expedição em 03/10; envio de item ao Pedido de Quadro em 22/10; raiz do pedido do Omie em 22/10. **Herdado.**

---

## 13.2 MES

> **Atualização de 04/11/2026:** o **MES saiu do produto** (menu, rotas, scripts e alçadas removidos) por decisão do Gelson; a Fabricação QC (`14_quadros_comando.md`, 14.4) é o acompanhamento que vale. Os arquivos `mes*.jsx` e as tabelas `mes_*` **ficam** até haver "Confirmo" para apagar. O texto abaixo descreve o que existia. **Conferido** (código e contagens do banco).

### 13.2.1 O que é
O acompanhamento da **OP de quadro de comando** no chão de fábrica, em **12 etapas** e 8 colunas de kanban, com checklist obrigatório, apontamento de tempo, bloqueios, testes e não conformidades. **Conferido** em `mes.jsx` (901 linhas).

**Fora do escopo:** gerar a OP (13.1); configurar frentes, postos e jornada (13.3).

### 13.2.2 Rota e arquivos
Rota `mes`; URL `/logistica/mes/<aba>[/<id da OP>]`; abas `kanban` (padrão), `painel`, `ordens`, `apontamentos`, `tv`. **Conferido.**

### 13.2.3 Perfil e acesso
Alçada `mes` (ver 9, criar 7, editar 7, excluir 2). O botão "Liberar OP" e as ações exigem `editar`. **Herdado**; contagens **Conferido**.

### 13.2.4 O que a tela mostra
Kanban (Aguardando + 8 colunas: Furação, Estrutura, Componentes, Fiação, Testes, Qualidade, Embalagem, Expedição; cor do card pelo prazo, cinza = bloqueada, roxo = retrabalho), Painel de indicadores, Ordens, Apontamentos (tempo médio por etapa) e **Painel TV** (somente leitura, tela cheia, recarrega a cada 30 s). **Conferido** (constante `MES_MACROS` e abas).

### 13.2.5 Botões e controles
Liberar OP para o MES, Iniciar produção, Iniciar etapa, Concluir etapa, pausar/retomar, bloqueios (8 motivos), registrar teste, abrir/corrigir/fechar NC, ligações elétricas, expedição. **Herdado.**

### 13.2.6 Comportamento
- A OP só avança por **Concluir etapa**; as travas (**gates**) são revalidadas no banco: NC aberta, furos executados = previstos (padrão 48), ligações cadastradas concluídas, testes (sem potência e energizado, último resultado aprovado), nº de série, dados de expedição. **Herdado**.
- Iniciar a produção no MES põe a OP do PCP em `em_producao`; concluir a **última** etapa conclui a OP no PCP (`data_finalizacao` hoje, `qtd_produzida` = quantidade, **perda 0**). **Herdado**.
- Teste reprovado exige descrição e **abre NC automática**; NC nascida em TESTES só fecha com teste aprovado depois da correção. **Herdado**.
- Abrir bloqueio **pausa a execução aberta**; material crítico "Faltante" abre bloqueio sozinho. **Herdado.**

### 13.2.7 Dados
`mes_ordens` (**1**, na etapa CONF_MEC), `mes_etapas` (12), `mes_checklist_modelo` (66), `mes_execucoes` (3), `mes_historico` (8), `mes_nc` (0), `mes_testes` (0), `mes_pausas`, `mes_bloqueios`, `mes_ligacoes`, `mes_checklist_resultados`; lê/grava também `pcp_ordens`, `pcp_ordem_materiais` e lê `pcp_pedidos`. **Conferido.**

### 13.2.8 Regras e armadilhas
- **As travas de fluxo são da tela; as tabelas estão abertas (achado, sem correção):** `mes_ordens`, `mes_execucoes`, `mes_pausas`, `mes_bloqueios`, `mes_nc`, `mes_checklist_resultados` aceitam SELECT/INSERT/UPDATE de `public`; `mes_ligacoes` aceita também **DELETE**. `mes_historico` e `mes_testes` aceitam INSERT/SELECT (sem UPDATE nem DELETE). Quem tem a chave pública pode mudar a etapa de uma OP sem passar pelos gates. **Conferido.**
- **Pouco uso real:** 1 OP no MES, 0 NC, 0 testes; o fluxo completo (testes, NC, expedição) **nunca foi exercitado com dado real**. **Conferido** (contagens).
- **Checklist de 66 itens transcrito do fluxograma — revisar com a produção.** **Herdado.**
- **Fotos/anexos por etapa, criação automática da OP, cronômetro para tablet, permissões por perfil, tela de pesos/checklists** não existem. **Herdado.**

### 13.2.9 Testes
`mes-cadastros-calc.test.js` cobre só o cadastro (13.3). **Não existe** teste do MES (gates, pausa, NC) — **Conferido**. Os índices únicos de pausa aberta e de bloqueio aberto por motivo não foram exercitados. **Herdado.**

### 13.2.10 Pendências e decisões
- **Achado, sem correção:** tabelas abertas (13.2.8).
- Perda não registrada ao concluir pelo MES (13.2.6).
- Integração da Expedição do MES com a Expedição do PCP (12.2): hoje só registra os dados de saída. **Herdado.**

### 13.2.11 Histórico
Entregue em 4 fases em 07/10/2026. **Herdado.**

---

## 13.3 MES · Cadastros

> **Atualização de 04/11/2026:** tela **removida do menu junto com o MES** (13.2); arquivos e tabelas ficam. O texto abaixo é histórico.

### 13.3.1 O que é
Cadastros que o MES usa: **Frentes, Postos, Etapas modelo, Jornada, Operadores**. **Conferido** em `mes-cadastros.jsx` (364 linhas) e `mes-cadastros-store.js`.

**Fora do escopo:** executar o fluxo (13.2).

### 13.3.2 Rota e arquivos
Rota `mes-cadastros`; abas `frentes` (padrão), `postos`, `etapas`, `jornada`, `operadores` (`useRouteTab`). Regras puras em `mes-cadastros-calc.js`. **Conferido.**

### 13.3.3 Perfil e acesso
Alçada `mes-cadastros` (ver 7, criar 7, editar 7, excluir 3). **Conferido** (contagem); uso na tela **Não verificado**.

### 13.3.4 O que a tela mostra
Uma tabela por aba, com cadastro e edição. **Conferido** (nomes das abas).

### 13.3.5 Botões e controles
Cadastrar, editar e inativar por aba. **Não verificado** o detalhe.

### 13.3.6 Comportamento
Valores de jornada e operador alimentam o apontamento de tempo do MES. **Não verificado.**

### 13.3.7 Dados
`mes_frentes`, `mes_jornada`, `mes_operador_posto` e `pcp_etapas_modelo` (5). **Conferido** (tabelas existem e estão abertas: SELECT/INSERT/UPDATE para `public`; `pcp_etapas_modelo` só SELECT).

### 13.3.8 Regras e armadilhas
Tabelas de cadastro abertas à chave pública (achado, sem correção). **Conferido.**

### 13.3.9 Testes
`mes-cadastros-calc.test.js`. **Conferido.**

### 13.3.10 Pendências e decisões
Tela de configuração dos **pesos** e do **checklist** do MES não existe (hoje só pelo banco). **Herdado.**

### 13.3.11 Histórico
Junto com o MES (07/10/2026), com ajustes posteriores. **Herdado.**

---

## 13.4 Carga Máquina

### 13.4.1 O que é
Cadastro dos **recursos produtivos** (mão de obra e máquinas) e a **capacidade** em horas líquidas por mês. **Conferido** em `carga-maquina.jsx` (379 linhas).

**Fora do escopo:** apontar horas (13.1).

### 13.4.2 Rota e arquivos
Rota `carga-maquina`; abas `capacidade` (padrão), `maquinas`, `roteiro`, `recursos`. **Conferido.**

### 13.4.3 Perfil e acesso
Alçada `carga-maquina` (ver 6, criar 6, editar 6, excluir 2). **Conferido** (contagem).

### 13.4.4 O que a tela mostra
Recursos com quantidade, horas por dia, dias por mês, eficiência e unidades por hora; capacidade comparada à carga das OPs, com alerta de sobrecarga (limites 85% e 100% fixos no código). **Herdado.**

### 13.4.5 Botões e controles
Cadastrar/editar recurso e roteiro (horas por unidade por produto × recurso). **Não verificado o detalhe.**

### 13.4.6 Comportamento
Capacidade (h) = quantidade × horas/dia × dias/mês × eficiência. **Conferido** (comentário e função `cmCalc`).

### 13.4.7 Dados
`pcp_recursos` (7), `pcp_roteiro` (**0**), lê `pcp_ordens`, `pcp_plano`, `pcp_estrutura`, `pcp_produtos`. **Conferido.**

### 13.4.8 Regras e armadilhas
`pcp_recursos` e `pcp_roteiro` abertos à chave pública (o roteiro também aceita DELETE) — achado, sem correção. Sem roteiro cadastrado, a **carga por produto não existe** (0 linhas), então a comparação com a carga é só da capacidade. **Conferido** (contagem e política).

### 13.4.9 Testes
Nenhum teste de unidade (`cmCalc` não tem teste). **Conferido.**

### 13.4.10 Pendências e decisões
Cadastrar o roteiro (horas por produto×recurso) para a carga funcionar. **Conferido** (0 linhas).

### 13.4.11 Histórico
Criada em out/2026 com o PCP. **Herdado.**

---

## 13.5 Matérias-Primas

### 13.5.1 O que é
Lista **somente leitura** dos itens de código `VPMP…` (insumo que só é consumido), espelhados do Omie em `pcp_produtos`. **Conferido** em `cadastro-itens.jsx` (126 linhas, compartilhado com 13.6).

**Fora do escopo:** editar (a origem é o Omie; custo manual em 12.1 › Custos).

### 13.5.2 Rota e arquivos
Rota `cadastro-materias-primas`; URL `/cadastros/cadastro-materias-primas` (a URL antiga foi mantida). Componente `CadastroMateriasPrimasPage`. **Conferido.**

### 13.5.3 Perfil e acesso
Alçada `cadastro-materias-primas` (ver 8, criar 8, editar 8, excluir 2). **Conferido** (contagem); a tela é só leitura.

### 13.5.4 O que a tela mostra
Tabela com código, descrição, família, unidade, NCM e demais colunas, com ordenação. **Conferido** (parcial).

### 13.5.5 Botões e controles
Busca e ordenação; atalhos para outras telas via `pcpIrPara`. **Conferido.**

### 13.5.6 Comportamento
**Regra única:** matéria-prima = código `VPMP%` (`pcpEhMateriaPrima`), usada também por Montagem, Simulação, PCP, Relatórios e painel de fotos. **Não decidir por `tipo_sped`** (classificação fiscal). **Conferido** (função no código).

### 13.5.7 Dados
`pcp_produtos`, `pcp_estrutura` (leitura). **Conferido.**

### 13.5.8 Regras e armadilhas
`pcp_produtos` aberta à chave pública (12.1.8). **Conferido.**

### 13.5.9 Testes
Nenhum teste próprio; entra no teste de fumaça. **Conferido.**

### 13.5.10 Pendências e decisões
Tutorial desatualizado (menu, colunas, regra). **Herdado.**

### 13.5.11 Histórico
Saiu de Cadastros Mestres para Fabricação em 18/10/2026 (rotas e alçadas mantidas). **Herdado.**

---

## 13.6 Produtos

### 13.6.1 O que é
Lista **somente leitura** de todo item que **não** é `VPMP`, com a coluna **Papel**: *Fabricado* (tem estrutura) ou *Mercadoria de estoque* (vendida e/ou componente). **Conferido** (linhas 94 e 109 de `cadastro-itens.jsx`).

**Fora do escopo:** editar; Ficha Técnica (8.4); catálogo de importação (7.9).

### 13.6.2 Rota e arquivos
Rota `cadastro-produtos`; URL `/cadastros/cadastro-produtos`; `CadastroProdutosPage`. **Conferido.**

### 13.6.3 Perfil e acesso
Alçada `cadastro-produtos` (ver 28, criar 6, editar 6, excluir 2). **Conferido** (contagem).

### 13.6.4 O que a tela mostra
Como 13.5, com a coluna Papel. **Conferido.**

### 13.6.5 Botões e controles
Busca e ordenação. **Conferido.**

### 13.6.6 Comportamento
Papel = "Fabricado" se o código aparece como pai em `pcp_estrutura`. **Conferido.**

### 13.6.7 Dados
`pcp_produtos` (187 no total), `pcp_estrutura` (632). **Conferido.**

### 13.6.8 Regras e armadilhas
Mesmas de 13.5.8. **Conferido.**

### 13.6.9 Testes
Nenhum próprio. **Conferido.**

### 13.6.10 Pendências e decisões
Tipo do Omie dos 11 kits sem a letra "a" a conferir. **Herdado.**

### 13.6.11 Histórico
Como 13.5. **Herdado.**

---

## 13.7 Montagem do Produto

### 13.7.1 O que é
Escolhe-se um produto (ex.: quadro de comando); mostra a **estrutura** (BOM) e o **custo** (soma dos filhos, com perda), e permite acrescentar itens extras que ficam só no PCP. Inclui a **Lista de fios** do quadro. **Conferido** em `montagem-produto.jsx` (206 linhas) e `lista-fios.jsx` (226).

**Fora do escopo:** editar a estrutura que vem do Omie (12.1 › Estrutura).

### 13.7.2 Rota e arquivos
Rota `montagem-produto`; URL `/logistica/montagem-produto/<código>` (`useRotaId`); a Lista de fios usa o valor reservado `lista-de-fios` no 2º segmento. **Conferido** (parte).

### 13.7.3 Perfil e acesso
Alçada `montagem-produto` (ver 10, criar 6, editar 6, excluir 2) e `lista-fios` (ver 5, criar 4, editar 4). Custos só com `almoxarifado.ver_custo`. **Conferido.**

### 13.7.4 O que a tela mostra
Estrutura do produto com quantidade, custo unitário e total; linhas do Omie somente leitura. Lista de fios com abas Fios, Bitola por variante, Códigos, Conectores, Resultado por variante e Chicotes da caixa de topo. **Conferido** (cabeçalho; abas **Herdado**).

### 13.7.5 Botões e controles
Inserir/remover item extra (origem `pcp`). Lista de fios: colar linhas do Excel, editar tabelas. **Herdado.**

### 13.7.6 Comportamento
Custo folha = custo efetivo; subconjunto = soma dos filhos. **Lista de fios — "a lista manda":** os códigos que a lista cobre saem dos materiais da OP e entram os calculados (evita contar fio, terminal e conector em dobro); variante sem bitola grossa cadastrada → a lista **não** é aplicada (nunca "escolher a mais próxima"). **Herdado.**

### 13.7.7 Dados
`pcp_estrutura` (só `origem 'pcp'` é apagável pela tela), `pcp_produtos`; Lista de fios: `fiacao_fios` (**0**), `fiacao_bitola_variante`, `fiacao_depara`, `fiacao_conectores`, `chicotes_caixa_topo` (**0**), todas fechadas (só `authenticated`). **Conferido** (contagens e políticas).

### 13.7.8 Regras e armadilhas
- `pcp_estrutura` aberta à chave pública, **com DELETE** (achado, sem correção).
- **A Lista de fios está vazia** (0 fios): a regra "a lista manda" só vale depois que a Engenharia cadastrar; sem fios, a OP segue como antes. **Conferido.**
- A lista não substitui a lista de fios do motor do Quadro de Comando (4.4): as duas contas podem divergir (decisão pendente). **Herdado.**

### 13.7.9 Testes
`fiacao-quadro-engine.test.js` cobre o motor de fios; a montagem não tem teste próprio. **Conferido.**

### 13.7.10 Pendências e decisões
Bitola grossa das outras 5 variantes e vias/código dos 18 conectores a informar pela Engenharia; itens faltantes (forquilha 0,75, faston, fio azul 0,75) a cadastrar no Omie. **Herdado.**

### 13.7.11 Histórico
Montagem em out/2026; Lista de fios em 19/10/2026. **Herdado.**

---

## 13.8 Evolução da Fabricação

> **Atualização de 04/11/2026:** esta tela **mudou de módulo e de nome**: hoje é a **Fabricação QC**, em `14_quadros_comando.md` (14.4), na URL `/quadros-de-comando/evolucao-fabricacao` (o endereço antigo continua abrindo). O texto detalhado das regras **continua aqui** até a tela ser reestruturada (Art. 44). **Conferido.**

### 13.8.1 O que é
Um card por **OP de quadro** em aberto, com **6 etapas fixas** flegáveis, fiação, ocorrências que pausam e o link do chão de fábrica. **Conferido** em `evolucao-fabricacao-quadro.jsx` (689 linhas).

**Fora do escopo:** o MES (13.2, desenho diferente e mais completo).

### 13.8.2 Rota e arquivos
Rota `evolucao-fabricacao`; URL `/logistica/evolucao-fabricacao`; página pública `/fabricacao-quadro/<token>` (`fabricacao-quadro-app.jsx`, `server.js`). Motor `fabricacao-quadro-calc.js`, store `fabricacao-quadro-store.js`. **Conferido.**

### 13.8.3 Perfil e acesso
**Não há linhas de alçada** para `evolucao-fabricacao` (nenhuma pessoa tem permissão específica: Conferido no banco). **Não verificado** como a tela decide quem entra.

### 13.8.4 O que a tela mostra
Cabeçalho do card com pedido do Omie, cliente, vendedor, prazo de entrega, "pedido criado em" e **SLA do prazo**; etapas, fiação, ocorrências. Cards nascem recolhidos; barra de busca (acha também nº do pedido do Omie e código do material em falta) e de ordenação. **Herdado.**

### 13.8.5 Botões e controles
Flegar etapa, **Criar ocorrência**, **Chegou — resolver**, copiar link, Expandir/Recolher. **Herdado.**

### 13.8.6 Comportamento
- **Prazo de entrega** = previsão do pedido no Omie; sem pedido, o prazo da OP. **SLA** em dias úteis (verde/amarelo/vermelho). **Herdado.**
- Ocorrência **sem frente de trabalho pausa a fabricação**; resolver reabre. **Herdado.**
- Datas puras `AAAA-MM-DD` usam `fqDataISO` (nunca `new Date('aaaa-mm-dd')`, que cai um dia). **Herdado.**

### 13.8.7 Dados
`fabricacao_quadro_itens`, `_status`, `_fiacao_itens`, `_fiacao_status`, `_links`, `_ocorrencias` (2), e leitura de `pcp_ordens`, `pcp_pedidos`, `quadros_comando`. **Conferido.**

### 13.8.8 Regras e armadilhas
- **Os links do chão de fábrica estão expostos (achado, sem correção, grave):** `fabricacao_quadro_links` (onde mora o **token**) e as demais `fabricacao_quadro_*` aceitam SELECT/INSERT/UPDATE de `public`, e a página pública lê e grava **direto nas tabelas**, não por RPC. Quem tem a chave pública lista todos os tokens e pode flegar etapas e abrir/fechar ocorrências de qualquer OP. Contraste: Corrimão/Corte (13.9) usam RPC por token e tabelas fechadas. **Conferido.**
- As 6 etapas fixas existem em paralelo às 12 etapas do MES: **duas verdades** sobre o mesmo quadro. **Conferido** (ambos existem; 24 OPs de quadro, só 1 no MES).

### 13.8.9 Testes
`fabricacao-quadro-calc.test.js`, `fabricacao-quadro-store.test.js`; a rota entra no teste de fumaça (a página pública de **Corrimão/Corte** está na lista de públicas do e2e; a do Quadro **não** — Conferido). **Não existe** teste da tela. 

### 13.8.10 Pendências e decisões
- **Achado, sem correção:** tokens e tabelas abertos (13.8.8).
- Decidir se o MES substitui a Evolução do Quadro. **Herdado** (pergunta aberta).

### 13.8.11 Histórico
Entregue em 19/10/2026; ocorrências pelo hub, busca e SLA em 22–23/10/2026. **Herdado.**

---

## 13.9 Fabricação Corrimão

### 13.9.1 O que é
Um card por **corrimão** (uma OP por unidade do pedido) com 6 etapas: **Mede, Corta, Prepara as pontas, Aplica as camadas, Vulcaniza, Acabamento**. **Conferido** (`FO_DESTINOS`, `fab_etapas` com 9 linhas no total).

**Fora do escopo:** Corte (13.10).

### 13.9.2 Rota e arquivos
Rota `fabricacao-corrimao`; `FabricacaoCorrimaoPage`, arquivos `fabricacao-oficina.jsx`, `-ui.jsx`, `-calc.js`, `-store.js`; página pública `/fabricacao-oficina/<token>` (`fabricacao-oficina-app.jsx`). **Conferido.**

### 13.9.3 Perfil e acesso
Alçada `fabricacao-corrimao` (ver 2, criar 2, editar 2). Enviar a partir da Separação exige `separacao.enviar_fabricacao` (12.3). **Conferido** (contagem).

### 13.9.4 O que a tela mostra
Cards agrupados por pedido (pai), com "Pedido Omie N", itens do pedido, trilha de etapas e link copiável. **Herdado.**

### 13.9.5 Botões e controles
Flegar, ocorrência (falta de material pausa), copiar link. **Herdado.**

### 13.9.6 Comportamento
Regras de flegar, pausar e concluir **moram no banco** (`public_fab_*`): flegar a 1ª etapa põe a OP `em_producao`; a última a conclui; só o sistema interno desmarca; OP pausada não deixa flegar. **Herdado.**

### 13.9.7 Dados
`fab_etapas` (9), `fab_links` (6), `fab_status` (17), `fab_ocorrencias` (0), `fab_sobras` (0), `pcp_ordens` (`frente 'corrimao'`). **Conferido.** Hoje há **0 OPs `corrimao`** (frentes existentes: corte, pedido, quadro). **Conferido.**

### 13.9.8 Regras e armadilhas
- **Tabelas `fab_*` fechadas** (só `authenticated`); o chão de fábrica fala por RPC com token (`public_fab_obter/flegar/ocorrencia/sobra`, executáveis por `anon`, **Conferido**). Este é o desenho a seguir no 13.8.
- Uma OP por unidade só para `UN/PC/PR/PAR/KIT`; metro/kg/litro = uma OP com a quantidade toda. **Herdado.**

### 13.9.9 Testes
`fabricacao-oficina-calc.test.js`; a página pública está no teste de fumaça (`/fabricacao-oficina/e2e-token`). **Conferido.** O clique de ponta a ponta nunca foi testado com dado real (**Herdado**).

### 13.9.10 Pendências e decisões
Nenhum corrimão foi fabricado por esta tela (0 OPs); validar o fluxo com a Magda. Pesos das etapas são suposição de implementação. **Herdado.**

### 13.9.11 Histórico
Entregue em 22/10/2026. **Herdado.**

---

## 13.10 Fabricação Corte

> **Atualização de 04/11/2026:** o Corte passou a tratar **só cabo de aço e cinta de tração**. O **cabo de manobra** e os cabos modulares (BST) foram para a Separação FAB QC (`14_quadros_comando.md`, 14.3). Existem 23 OPs de corte antigas desses cabos ainda "aguardando", fora da tela (pendência em 14.3.10). **Conferido** (`categoriaCorte` devolve nulo para manobra).

### 13.10.1 O que é
Acompanha os itens de **corte** — **Cabos de Aço, Cintas de Tração e Cabos de Manobra** — em 3 etapas (**Separar material, Corte, Qualidade**), com registro de **sobra**. **Conferido** (`FO_DESTINOS`).

**Fora do escopo:** Corrimão (13.9); expedir o que foi cortado (12.2).

### 13.10.2 Rota e arquivos
Rota `fabricacao-corte`; `FabricacaoCortePage`, mesmos arquivos de 13.9. **Conferido.**

### 13.10.3 Perfil e acesso
Alçada `fabricacao-corte` (ver 2, criar 2, editar 2). **Conferido.**

### 13.10.4 O que a tela mostra
Cards como 13.9, sempre como `código — descrição comercial`. OPs de corte hoje: **24** (16 aguardando, 3 em produção, 5 concluídas). **Conferido.**

### 13.10.5 Botões e controles
Flegar, ocorrência, **registrar sobra**, e, na OP concluída, **Enviar para Expedição** (cabo de aço) ou **Enviar para Quadro de Comando** (cabo de manobra). **Herdado.**

### 13.10.6 Comportamento
Só entra o que está no dicionário `CORTE_DESCRICOES` (30 códigos) **ou** cuja descrição cita "cabo de aço", "cinta de tração" ou "cabo de manobra/comando". O código efetivo vem de `FabOficinaCalc.codigoDaOrdem` (item ou, na falta, extraído do título): **use sempre essa função**. **Herdado.**

### 13.10.7 Dados
Como 13.9; lê descrição de `pcp_produtos` e `importacao_varejo_produtos`; grava `separacao_destinos` ao encaminhar (0 linhas hoje). **Conferido** (contagem).

### 13.10.8 Regras e armadilhas
- OP de corte antiga sem código e sem esses termos no título **deixa de aparecer** (não é bug). **Herdado.**
- Os 10 códigos `VPB-097…106` têm descrição vazia no dicionário (vem do cadastro). **Herdado.**
- Tabelas fechadas e RPC por token, como 13.9. **Conferido.**

### 13.10.9 Testes
`fabricacao-oficina-calc.test.js` (inclui o dicionário e o código efetivo). **Conferido.**

### 13.10.10 Pendências e decisões
Pesos 30/40/30 das etapas são suposição minha, não do usuário. **Herdado.**

### 13.10.11 Histórico
Criada em 22/10/2026; escopo restrito em 30/10/2026; destinos em 26/10/2026. **Herdado.**

---

## 13.11 Simulação

### 13.11.1 O que é
Escolhe produto e quantidade; mostra o que 1 e N unidades consomem, o custo da matéria-prima e o que **falta comprar** contra o estoque. **Conferido** em `simulacao-producao.jsx` (152 linhas).

### 13.11.2 Rota e arquivos
Rota `simulacao-producao`; `SimulacaoProducaoPage`. **Conferido.**

### 13.11.3 Perfil e acesso
Alçada `simulacao-producao` (ver 6, criar 6, editar 6, excluir 2); custos só com `almoxarifado.ver_custo` (senão borrados). **Conferido.**

### 13.11.4 O que a tela mostra
Tabela de materiais explodida até as folhas (quantidade por unidade, com perda), custo e falta. **Conferido.**

### 13.11.5 Botões e controles
Escolha de produto e quantidade. **Conferido.**

### 13.11.6 Comportamento
Explode `pcp_estrutura` com proteção contra ciclo; compara com `pcp_estoque`. **Conferido.**

### 13.11.7 Dados
Lê `pcp_produtos`, `pcp_estrutura`, `pcp_estoque`. **Conferido.**

### 13.11.8 Regras e armadilhas
Somente leitura. Usa o estoque do Omie (físico), sem considerar reservas. **Não verificado** se usa físico ou disponível.

### 13.11.9 Testes
Nenhum próprio. **Conferido.**

### 13.11.10 Pendências e decisões
Sem pendência registrada.

### 13.11.11 Histórico
Out/2026, junto com o PCP. **Herdado.**

---

## 13.12 Relatórios

### 13.12.1 O que é
Relatórios e painéis **somente leitura** do PCP. **Conferido** em `relatorios-pcp.jsx` (758 linhas) e os painéis irmãos.

### 13.12.2 Rota e arquivos
Rota `relatorios-pcp`; abas `painel` (padrão), `pedidos`, `precos`, `producao`, `perdas`, `estoque`, `fluxo`, `clientes`, `fotos`. **Conferido.**

### 13.12.3 Perfil e acesso
Alçada `relatorios-pcp` (ver 8, criar 7, editar 7, excluir 3). Custo e lucro só com `almoxarifado.ver_custo`; margem exige também `pcp.ver_hh`. **Conferido** (contagens).

### 13.12.4 O que a tela mostra
**Painel** (pedidos em produção, OPs atrasadas, % de perda, pedidos sem OP), **Pedidos** (custo/lucro/margem por item), **Lista de Preços**, **Produção** (planejado × realizado), **Perdas**, **Estoque**, **Fluxo de Caixa** (resultado do PCP, não o caixa do banco), **Clientes**, **Produtos com foto** (foto da Ficha Técnica). **Herdado** (nomes de abas **Conferido**).

### 13.12.5 Botões e controles
Seletor de ano, filtros, atualizar pedidos do Omie. **Herdado.**

### 13.12.6 Comportamento
Lucro bruto = receita − custo dos materiais (estrutura × custo **atual**), **sem** mão de obra, impostos, frete nem comissão; componente sem custo entra como 0 e o item ganha ⚠ "custo incompleto" (**nunca remover o aviso**). OP sem `produto` não entra. **Herdado.**

### 13.12.7 Dados
`pcp_pedidos`, `pcp_pedido_itens`, `pcp_ordens`, `pcp_plano`, `pcp_estrutura`, `pcp_produtos`, `pcp_estoque`, `pcp_consumo_mov`, `pcp_posicao_compra`, `pcp_reposicao_config`, `pcp_pedido_acompanhamento`; chama `pcp-hh` e `sync-pcp-pedidos`. **Conferido.**

### 13.12.8 Regras e armadilhas
A margem do Fluxo de Caixa superestima enquanto há pedido não produzido. A cobertura de fotos é baixa (a Ficha Técnica cobre poucos itens do PCP). **Herdado.**

### 13.12.9 Testes
Nenhum teste de unidade dos relatórios. **Conferido.**

### 13.12.10 Pendências e decisões
Decisão do Financeiro sobre o fator de encargos da HH (hoje 1). **Herdado.**

### 13.12.11 Histórico
Relatórios e painéis entre 02 e 03/10/2026. **Herdado.**

---

# Parte comum de Fabricação

## PC-1 Mapa de ligações
**Herda de:** Omie (pedidos de venda, produtos, estrutura, estoque), 4.4 Formulário do Quadro de Comando (pedido de quadro, BOM), 12.3 Separação (itens "Na operação"), 12.1 Almoxarifado (estoque, custo). **Doa para:** 12.2 Expedição e 5.4 Emissão de NF (OP-mãe concluída), Omie (baixa de produção), Central de Notificações (alertas), 12.1 (compra a partir da Necessidade). **Selo:** Herdado.

## PC-2 Do pedido à fábrica: os três acompanhamentos
Pedido do Omie (etapa 20) → **PCP** gera OP-mãe + frentes (13.1) → a frente de quadro pode ser acompanhada de **três** maneiras: **MES** (12 etapas, checklist, tempo, NC — 13.2), **Evolução do Quadro** (6 etapas por link — 13.8) ou, para corrimão e corte, **Oficina** (etapas por link — 13.9/13.10). As duas primeiras coexistem para o mesmo quadro; hoje há 24 OPs de quadro e 1 no MES. Concluir a última etapa do MES conclui a OP no PCP; concluir a OP-mãe libera a NF e a Expedição. **Herdado**, contagens **Conferido**.

## PC-3 Rotas, páginas públicas e arquivos
URLs ainda em `/logistica/...` (e `/cadastros/...` para Matérias-Primas e Produtos). Públicas: `/fabricacao-quadro/<token>` e `/fabricacao-oficina/<token>` (`server.js`, **Conferido**); só a segunda está na lista do teste de fumaça. Mudar a URL é decisão à parte (quebraria link salvo).

## PC-4 Regras de negócio que atravessam as telas
- **O nº do pedido do Omie é a raiz** de toda OP; id novo do site sempre cita o pai (`numero_pedido_omie`, `itens_pedido`). **Herdado.**
- **Regra única de matéria-prima:** `VPMP%`. **Conferido.**
- **Custo efetivo:** Omie → compras → manual (12.1.6). **Herdado.**
- **Quadro:** a lista de materiais vem da estrutura do produto no Omie; a lista fixa antiga só vale se a variante não tem produto no Omie. **Herdado.**
- **Todo cabo e chicote é feito na VerticalParts** (nada vem pronto do fornecedor): o BOM do quadro tem um chicote nosso para cada conector. **Herdado.**
- **Comprimento do cabo de manobra** calibrado num cabo real (10 paradas × 3 m = 47 m; os 10 m do quadro até a caixa são regra fixa). **Herdado.**

## PC-5 Quem faz o quê (alçadas, custo, hora-homem)
Resumo **Conferido** (contagens de pessoas, 01/11/2026): `pcp` ver 11/criar 7/editar 7/apontar_hh 7/ver_hh 3; `mes` ver 9/editar 7; `mes-cadastros` ver 7; `carga-maquina` ver 6; `cadastro-materias-primas` ver 8; `cadastro-produtos` ver 28; `montagem-produto` ver 10; `simulacao-producao` ver 6; `relatorios-pcp` ver 8; `fabricacao-corrimao` e `fabricacao-corte` ver 2; `lista-fios` ver 5/editar 4; `evolucao-fabricacao` **sem linhas**. **Custo de material** só com `almoxarifado.ver_custo`; sem ela o dado nem é pedido ao banco. **Hora-homem:** valor só pela função `pcp-hh`, ação `custos`, para `pcp.ver_hh`; tabelas `pcp_hh_*` de valor com RLS sem política. Administrador passa sempre.

## PC-6 Identidade, alçadas e segurança
O app usa a chave pública; trava de tela é organização (Art. 25; #571). **Conferido hoje (`pg_policies`):**
| Tabelas | Política |
|---|---|
| `pcp_ordens`, `pcp_ordem_etapas`, `pcp_ordem_materiais`, `pcp_ordem_checklist`, `pcp_produtos`, `pcp_estoque`, `pcp_recursos`, `pcp_produto_fornecedor` | SELECT, INSERT, UPDATE para `public` |
| `pcp_estrutura`, `pcp_plano`, `pcp_roteiro` | SELECT, INSERT, UPDATE e **DELETE** para `public` |
| `mes_ordens`, `mes_execucoes`, `mes_pausas`, `mes_bloqueios`, `mes_nc`, `mes_checklist_resultados`, `mes_frentes`, `mes_jornada`, `mes_operador_posto` | SELECT, INSERT, UPDATE para `public` |
| `mes_ligacoes` | SELECT, INSERT, UPDATE e **DELETE** para `public` |
| `mes_historico`, `mes_testes` | SELECT, INSERT (sem UPDATE/DELETE) |
| `mes_etapas`, `mes_checklist_modelo`, `pcp_etapas_modelo`, `pcp_quadro_variante`, `pcp_codigo_alias`, `pcp_pedidos`, `pcp_pedido_itens` | SELECT para `public` |
| `fabricacao_quadro_*` (6 tabelas, **inclui os tokens dos links**) | SELECT, INSERT, UPDATE para `public` |
| `quadros_comando` | `authenticated` ALL **e** `anon` SELECT/INSERT/UPDATE |
| `quadros_comando_bom_itens` | ALL para `anon` e `authenticated` |
| `fab_*` (5 tabelas), `fiacao_*` (4), `chicotes_caixa_topo` | só `authenticated` |
Os caminhos públicos novos (Corrimão/Corte) são por RPC com token; os antigos (Evolução do Quadro, MES) não. **Achado, sem correção.**

## PC-7 Gatilhos, eventos, crons e funções
Crons deste módulo: `sync-pcp-pedidos-etapa20`, `-abertos`, `-previsao-etapa10`, `pcp-pedidos-tirar-etapa10`, `pcp-alerta-prazos-diario` (10:05 UTC seg–sex) e `pcp-carga-semanal-1/2/3` (domingo) — **Conferido** que existem e estão ativos; o corpo de `pcp-carga-semanal-*` e de `pcp_carga_snapshot_tirar` **Não reconferi**. Funções de borda: `pcp-omie-escrever`, `pcp-hh`, `sync-pcp-pedidos`, `sync-pcp-os`, `sync-pcp-omie` (**Herdado**; lista não reconsultada). Banco: `public_fab_*` (anon), `pcp_ordens_raiz_pedido` (gatilho). Eventos de fluxo: nenhum registrado por este módulo (**Não verificado**).

## PC-8 Tabelas
`pcp_*` (produtos, estoque, estrutura, ordens, etapas, materiais, checklist, plano, recursos, roteiro, pedidos, itens, previsão, hh_*), `mes_*` (12 tabelas), `fab_*` (5), `fabricacao_quadro_*` (6), `fiacao_*` (4), `chicotes_caixa_topo`, `quadros_comando` e filhas. Contagens em 13.x.7.

## PC-9 Navegação, cache e testes
Aba na URL (`useRouteTab`) e item na URL (`useRotaItem`/`useRotaId`); ao criar aba, incluir na lista de válidas e rodar `node scripts/gerar-mapa-rotas.js`. Testes existentes: `pcp-pedido-sla`, `fiacao-quadro-engine`, `quadro-comando-*`, `mes-cadastros-calc`, `fabricacao-quadro-calc/store`, `fabricacao-oficina-calc`, `alerta-pcp-paridade`. **Sem teste:** `pcp.jsx`, `mes.jsx`, relatórios, carga máquina, montagem, simulação. Cache-busting `?v=` obrigatório (Art. 19).

## PC-10 Menu "?" e tutoriais
**Não verificado** quais tutoriais cobrem as telas do grupo e se estão atualizados; o `CLAUDE.md` registra o de Matérias-Primas, Produtos e Cadastros Mestres como desatualizados. Tutorial passa pela sessão de tutoriais (Art. 46).

## PC-11 Documentos soltos e destino do que foi concatenado
Seções do `CLAUDE.md` que tratam do módulo e têm destino aqui (a troca por ponteiro depende da confirmação do Gelson, Art. 13): "PCP — Planejamento e Controle da Produção" (parte de fabricação e relatórios), "MES — Sistema de Execução da Manufatura", "Evolução da Fabricação do Quadro", "PCP › Pedidos para Produzir" (as duas), "Fabricação Corrimão + Corte + envio direto da Separação", "Fabricação Corte — escopo restrito", "Lista de fios do quadro de comando", "Matérias-Primas × Produtos — regra VPMP", "Rastreabilidade — o nº do pedido do Omie é a raiz", "Etiquetas › Chicote do quadro" (→ 12.4) e as seções do Quadro de Comando (BOM, formulário público, chicotes, cabo de manobra — já em 4.4). Specs: `2026-10-19-evolucao-fabricacao-quadro-design.md` e `2026-10-22-fabricacao-corrimao-corte-design.md` (histórico). **Nada foi apagado.**

## PC-12 Benefícios trocados com os outros módulos

- **Recebido de Quadros de Comando (04/11/2026, texto em `14_quadros_comando.md` PC-12, Art. 49):** (a) o Omie repete a linha do item com **quantidade 0** — somar por código e ignorar o zero antes de contar linhas ou unidades; (b) **metro e peça nunca se somam** — total por unidade de medida; (c) a caixa de uma tabela longa deve ter a **altura da janela**, para a barra de rolagem lateral ficar à vista; (d) função de banco nova se testa **numa transação que se desfaz**, incluindo um usuário ativo **sem** a alçada (a recusa por "sem sessão" não prova a trava de alçada); (e) a **observação do item** do pedido do Omie (`pcp_pedido_itens.obs_item`) guarda o que a proposta mostra dentro do item. **Conferido** (04/11/2026).
**Recebidos:** de Logística Interna — escrita no Omie em dois passos; estado calculado em vez de novo valor de coluna; parâmetro de decisão não fica aberto; afirmação de documento envelhece; link como senha. **Doados** (texto nos documentos de 1 a 12, linha "Recebido de Fabricação"): ver cada módulo.
- **Recebido de Administração (01/11/2026, texto em `15_administracao.md` PC-12):** o contraste de segurança Corrimão/Corte (RPC por token, tabelas fechadas) × Evolução do Quadro (tabelas abertas) é o melhor exemplo da Ordem de fechamento do #571 (14, PC-4). **Herdado.**
- **Recebido de Serviços (01/11/2026, texto em `16_servicos.md` PC-2):** todo alerta com destinatário também vira WhatsApp pelo gi-avisos; para chegar certo, título curto com o essencial na frente, sem "teste", sem R$ no título e com o dia da semana por extenso, a obra ou o código do contrato quando houver vários no mesmo dia (o agrupamento de 24 h apaga números). **Conferido** no código do gi-avisos.
