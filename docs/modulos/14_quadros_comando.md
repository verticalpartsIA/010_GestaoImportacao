# 14 Quadros de Comando — documento do módulo (REAL, fonte da verdade — 04/11/2026)

> **Status: REAL (documento oficial do módulo 14), criado a pedido do Gelson em 04/11/2026**, no molde de `01_geral.md` a `13_fabricacao.md`. Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que este módulo existe (decisão do Gelson, 04/11/2026):** tudo o que é de **quadro de comando** deve morar **dentro deste módulo**, salvo as **Etiquetas**. O desenho-alvo é: o pedido de venda (ou a Ordem de Serviço) que vem do **Omie** chega aqui, **alimenta sozinho** a Separação e a Fabricação, e essas telas ficam ligadas às Etiquetas. O objetivo é acabar com telas que guardam a mesma informação em dois lugares. **Hoje o módulo está em construção:** as quatro telas abaixo existem e funcionam; a **entrada automática** do Omie **ainda não existe** (a OP do quadro continua nascendo pelo "Gerar OPs" do PCP, 13.1), e as **Etiquetas** ainda leem `quadros_comando` do Formulário ilhado, mas não mais `mes_ordens` (PC-11).
>
> **Fonte da verdade:** o código e o banco, conferidos em 04/11/2026 (`origin/main` `43baa55`, mais as mudanças locais desta sessão, ainda sem commit). **Conferido** = lido no código ou consultado no banco (só SELECT, ou transação desfeita) nesta data; **Herdado** = veio do `CLAUDE.md`, de spec ou do documento de outro módulo e **não** foi reconferido; **Não verificado** = não consegui confirmar. Sem selo vale como Não verificado (Art. 6).
>
> **Escopo do módulo:** as **quatro** telas do grupo "Quadros de Comando" do menu (`NAV_GROUPS` em `shell.jsx`, nesta ordem): **Pedidos com Quadro**, **Separação PV QC**, **Separação FAB QC** e **Fabricação QC** (a antiga "Evolução da Fabricação", que veio do módulo 13). **Não** são deste módulo: as **Etiquetas** (12.4, por decisão do Gelson); o **Formulário do Quadro de Comando**, o link público e a **Cotação Quadro de Comando**, que ficaram **ilhados** (desligados do hub, sem item de menu; documentados em 4.1 e 4.4) até serem ligados ao Omie; o **Corte** de cabo de aço e cinta (13.10); o PCP (13.1), que ainda cria as OPs.
>
> **Já documentado em outro lugar (não se repete, aponta):** o pedido do Omie e a fila `pcp_pedidos` (13, PC-2 e 12, PC-2); o motor de BOM e o formulário técnico do quadro (4.1 e 4.4); a Separação geral do almoxarifado (12.3); a tabela de alçadas e a identidade (15, PC-2).

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md`. Aqui vale a mesma: módulo = **14**; telas filhas = **14.1 a 14.4**, na ordem do menu; o conteúdo comum fica na **Parte comum**, sem número de tela.
- **Tudo o que é aba, janela ou página pública de uma tela pertence a ela.** A página pública que o operador abre (`fabricacao-quadro.html`) está no 14.4.
- **Renumeração (04/11/2026):** Quadros de Comando entrou como o módulo **14**; Administração passou de 14 para **15** e Serviços de 15 para **16**.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
14. **Quadros de Comando**
   14.1 Pedidos com Quadro · 14.2 Separação PV QC · 14.3 Separação FAB QC · 14.4 Fabricação QC · 14.5 Calculadora de Cabos
   &nbsp;&nbsp;&nbsp;Cada tela tem os temas: x.1 O que é · x.2 Rota e arquivos · x.3 Perfil e acesso · x.4 O que a tela mostra · x.5 Botões e controles · x.6 Comportamento · x.7 Dados (lê/grava) · x.8 Regras e armadilhas · x.9 Testes · x.10 Pendências e decisões · x.11 Histórico
   Parte comum de Quadros de Comando (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações e fios desligados · PC-2 Do Omie à fábrica: o que é um "quadro" · PC-3 Rotas, páginas públicas e arquivos · PC-4 Regras de negócio que atravessam as telas · PC-5 Quem faz o quê (alçadas) · PC-6 Identidade e segurança · PC-7 Rotinas, funções e crons · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
15. Administração → `15_administracao.md` (REAL)

## Glossário (módulo Quadros de Comando)
Termos gerais (alçada, soft-delete, evento de fluxo) estão em `01_geral.md`; **OP, OP-mãe, frente, BOM** em `13_fabricacao.md`; **Separação do almoxarifado** em `12_logistica_interna.md`. Não se repetem aqui.
- **QC:** quadro de comando (o quadro elétrico do elevador). **PV QC:** pedido de venda de quadro de comando. **FAB QC:** fabricação do quadro de comando.
- **Pedido (aqui):** o pedido de venda ou a **Ordem de Serviço** do **Omie**, com o **número do Omie** (`pcp_pedidos.numero_pedido`). É o único número que aparece como principal nas telas do módulo. Não confundir com o **pedido de quadro interno** (`quadros_comando.numero_pedido`, sequência do hub) nem com o número da OP (`OP-0012-Q1`).
- **Quadro de uma linha de pedido:** a linha cujo código está em `pcp_quadro_variante` ou é o produto de uma OP de quadro do mesmo pedido (ex.: 702b, 704b).
- **Kit do quadro:** o que vai **com** o quadro e não se separa à parte: o **cabo de manobra** e os **cabos modulares** (BST). Identificados pela descrição que começa com "Cabo".
- **Componentes do quadro:** as linhas que a proposta mostra dentro do item do quadro (inversor, placas, sensores, interfones…). Vêm da **observação do item** no pedido do Omie (`obs_item`).
- **Item de separação:** a linha do pedido que o almoxarifado separa: tudo o que **não** é quadro, cabo do kit, matéria-prima (VPMP) nem serviço (VPSVC). Inclui botões, placa de display, botão de chamada, encoder e a **máquina de tração**.
- **Peguei:** a marca de que a pessoa pegou o item (`qc_separacao_itens`), com quem e quando; o histórico fica em `qc_separacao_hist`.
- **OP de quadro:** linha de `pcp_ordens` com `frente = 'quadro'`; é o que a Fabricação QC acompanha.
- **MRL / MR:** elevador **sem** casa de máquinas (MRL) ou **com** casa de máquinas (MR); muda a última parcela da conta do cabo de manobra (14.5).

---

## 14.1 Pedidos com Quadro

### 14.1.1 O que é
A porta de entrada do módulo: lista os **pedidos de venda e Ordens de Serviço do Omie que têm quadro de comando**, com o número do Omie na frente e duas barras: **Fabricação** (andamento) e **Separação** (quanto há para separar). **Só leitura**; a linha ainda **não é clicável**. **Conferido** em `quadros-pedidos.jsx` e `quadros-pedidos-store.js` (abertas e executadas em 04/11/2026).

**Fora do escopo:** abrir o detalhe do pedido e qualquer ação que grave (os próximos pontos do módulo); criar a OP (13.1); o acompanhamento etapa a etapa (14.4).

### 14.1.2 Rota e arquivos
Rota `quadros-pedidos`; URL `/quadros-de-comando/quadros-pedidos`. Componente `QuadrosPedidosPage` (`quadros-pedidos.jsx`); a carga de dados é `window.QuadrosPedidosStore.carregar` (`quadros-pedidos-store.js`), usada também pelas duas Separações; as regras puras estão em `quadros-pedidos-calc.js` (`window.QuadrosPedidosCalc`). O menu, o título e o caminho (breadcrumb) estão em `shell.jsx` e `app.jsx`; a rota em `router.js`. O servidor aceita o primeiro segmento `quadros-de-comando` (`SPA_MODULES` em `server.js`). **Conferido.**

### 14.1.3 Perfil e acesso
Sem alçada própria na tela: quem vê o grupo "Quadros de Comando" no menu abre a tela. O grupo aparece para quem tem a alocação "Quadros de Comando" **ou** "Fabricação" **ou** "Logística Interna" (apelido em `shell.jsx`, para ninguém perder acesso); o Administrador vê tudo. O módulo `quadros-pedidos` existe no catálogo de alçadas (`colaboradores-admin-store.js`) com as ações padrão. **Conferido** (código). **Não verificado** se a página barra quem digita a URL sem alocação.

### 14.1.4 O que a tela mostra
Uma linha **por pedido do Omie**, com sete colunas: **Nº do pedido**, **Cliente**, **Vendedor**, **Incluído no Omie** (`pcp_pedidos.data_pedido`), **Prazo de entrega** (`data_previsao`), **Fabricação** e **Separação**. Ordem inicial: prazo mais próximo primeiro; todos os cabeçalhos ordenam ao clicar. Em 04/11/2026 são **12 linhas**: 28713, 29501, 29537, 29775, 29776, 29782, 29783, 29972 (etapa 00 no Omie), 30613, 30614, 30696 e a **OS 1212**. **Conferido** (leitura na tela).
- **Fabricação:** barra de 0 a 100% = **média do andamento das OPs de quadro do pedido**, o **mesmo percentual da Fabricação QC** (14.4); quadro do pedido **sem OP conta como 0%** (30613 e 30614 mostram "sem OP"). Embaixo: "N quadro(s)" e "+ N itens do kit".
- **Separação:** **linhas e unidades** do que o almoxarifado separa (ex.: 30614 = "12 itens · 23 un."); "—" quando não há nada a separar (a OS 1212, só serviço). Por ora **sem status** (a barra de separação foi trocada por número a pedido do Gelson; o status entra depois).
- Etiquetas pequenas: **OS** (Ordem de Serviço) e "etapa N no Omie" quando o pedido não está na 20 (o 29972 está na 00).

### 14.1.5 Botões e controles
Ordenar por coluna e **🖨 Imprimir** (abre a impressão do navegador, A4 deitado, sem menu nem botões e com a data e o nome de quem imprimiu; estilos em `styles/quadros-comando.css`; o `@page` fica **fora** do `@media print`, senão o Chrome ignora e imprime em retrato — achado de 05/11/2026) e **🔗 Link público** (14.5 a PC-3: mostra, copia ou troca o link secreto da página de acompanhamento dos gestores). Sem clique na linha. **Conferido** (código; a impressão em papel/PDF **não foi vista** nesta sessão).

### 14.1.6 Comportamento
Recarrega sozinha a cada minuto e ao voltar para a aba. A caixa da tabela tem a **altura da janela** (cálculo por `getBoundingClientRect`), para a **barra de rolagem lateral ficar sempre à vista** (a altura fixa "tela − 190 px" do padrão `pcp-rolagem` deixava a barra fora da tela nesta página). A altura é **recalculada a cada renderização**: avisos que aparecem depois da carga (como o de "sem acesso") empurravam a caixa e a barra saía da janela. **Conferido** (medido: a caixa termina em 825 px numa janela de 846 px).

### 14.1.7 Dados
**Só lê:** `pcp_quadro_variante` (5 variantes com produto; a de 30 kW/220 V ainda sem produto), `pcp_ordens` (OPs de quadro `aguardando`/`em_producao`: **18** em 04/11/2026; 25 no total), `fabricacao_quadro_status` e `fabricacao_quadro_itens` (andamento), `pcp_pedidos` e `pcp_pedido_itens`. Nenhuma gravação. **Conferido** (consultas e código).

### 14.1.8 Regras e armadilhas
- **Quem entra:** (a) pedido do Omie na **etapa 20**, não cancelado e fora de `so_separacao`, com **item que é quadro** (`pcp_quadro_variante`); e (b) o pedido de **toda OP de quadro ativa**, pelo `pedido_codigo` da OP ou, na Ordem de Serviço, pelo da **OP-mãe**. É por isso que aparecem o 29972 (etapa 00) e o 29537 (quadros "b", fora da tabela de variantes).
- **OP de quadro sem pedido de venda do Omie não entra** (decisão do Gelson, 04/11/2026: "não tem como fabricar algo que não é um pedido de venda"). Eram 7 OPs (OP-0014-Q a OP-0020-Q, de 22/10), duplicatas de OPs dos pedidos 29537, 29783, 29501, 28713, 29776, 29775 e 29782; foram **canceladas** com o "Confirmo" do Gelson (14 OPs, incluindo as 7 OPs-mãe). **Conferido** (consulta antes e depois).
- **O mesmo número pode ter dois registros no Omie** (parcial): o **29972** tem um registro na etapa 00 (a proposta, quase todo zerado) e outro na **etapa 70, faturado** (NF 21995, 49 unidades). A OP está ligada ao registro da proposta, por isso a coluna Separação mostra "1 item · 1 un." (achado, sem correção; 14.1.10). **Conferido.**
- O Omie repete a mesma linha de item **com quantidade 0**; o cálculo soma por código e ignora o que fica em zero (PC-4).
- **A quantidade de quadros** do pedido vem das linhas de variante (30614 = 2); OP a menos que isso baixa a média.

### 14.1.9 Testes
`quadros-pedidos-calc.test.js` (12 testes: média de andamento, classificação, kit, separação, componentes, linha com quantidade 0, Ordem de Serviço, chave da OP). A tela e a carga de dados **não têm** teste de unidade nem e2e (**Conferido**); a rota entra no teste de fumaça. Cenário: **Dado** o pedido 30614 (2 quadros, nenhuma OP), **quando** a pessoa abre Pedidos com Quadro, **então** vê "30614", "sem OP" na Fabricação e "12 itens · 23 un." na Separação.

### 14.1.10 Pendências e decisões
- **Achado, sem correção:** o 29972 mistura dois registros do Omie (14.1.8); decidir se a tela soma os registros do mesmo número.
- **Decidir:** a linha clicável (detalhe do pedido) e quais ações entram.
- **A entrada automática do Omie** (criar as OPs de quadro quando o pedido chega à etapa 20) **não existe**: hoje é o "Gerar OPs" do PCP (13.1). **Decisões pendentes (Gelson):** uma OP por quadro físico, estrutura padrão do Omie, lista de fios aplicada na criação, rotina agendada ou gatilho.
- A coluna Separação ganhará **status** quando for ligada à Separação (14.2/14.3).

### 14.1.11 Histórico
Criada em 04/11/2026, com as colunas pedidas pelo Gelson; a coluna Separação passou de barra para número no mesmo dia. **Conferido** (conversa e código).

---

## 14.2 Separação PV QC

### 14.2.1 O que é
"Separação Pedidos de Venda Quadro de Comando": os mesmos pedidos de 14.1, em **duas colunas** (Nº do Pedido e Cliente); **clicar no pedido expande** e mostra o que o almoxarifado **separa**, cada item com a caixa **Peguei**. **Conferido** em `quadros-separacao.jsx` (componente `QuadrosSeparacaoPage`).

**Fora do escopo:** os cabos e os componentes do quadro (14.3); o quadro em si (14.4); a separação geral do almoxarifado (12.3); baixar estoque ou escrever no Omie.

### 14.2.2 Rota e arquivos
Rota `quadros-separacao`; URL `/quadros-de-comando/quadros-separacao[/<codigo_pedido>]` (o pedido aberto fica no 2º segmento, `useRotaId`; F5 e Voltar funcionam). Arquivo `quadros-separacao.jsx` (a tela comum às duas Separações é `QcSeparacaoTela`); dados por `quadros-pedidos-store.js` (`carregar`, `listarPegos`, `marcar`); regras em `quadros-pedidos-calc.js`. **Conferido.**

### 14.2.3 Perfil e acesso
Gravar "Peguei" exige **sessão real do portal** e a alçada `quadros-separacao` **editar**; ler o que já foi pego exige **ver** (decisão no banco, funções abaixo). Em 04/11/2026 a alçada (`ver` e `editar`) foi concedida a **9 perfis** do departamento Logística/Almoxarifado/Produção (18 linhas, `concedido_por` "sistema (04/11/2026 — Separação PV QC…)", com o "Confirmo" do Gelson): Almoxarifado, Caio Silva, Danilo Oliveira, Franklin Costa, Geovanna Resende, Magda Torres, Matheus Leão (conta de Expedição), Produção Corrimão (conta compartilhada) e Tiago Acácio. O Administrador passa sempre. **Conferido** (`alcadas_capacidade`).

### 14.2.4 O que a tela mostra
Tabela de duas colunas. Aberto o pedido: "N de M itens pegos · <total por unidade>" e a tabela **Peguei · Código · Descrição · Quantidade · Un.** Item pego mostra "quem · dia e hora" e fica esmaecido. **Total por unidade de medida** ("23 PC"; **metro e peça nunca se somam**). Itens da lista = os "itens de separação" (Glossário). **Cinco colunas novas (04/11/2026):** **Em estoque** (estoque **físico** do Omie, de `importacao_varejo_estoque`, senão `pcp_estoque`), **Estoque real** (o usuário **digita** o que há de verdade na prateleira; em branco vale o do sistema), **Falta** (quantidade do pedido − estoque, nunca negativa, usando o **real** se digitado; ex.: pede 23, sistema 14, **faltam 9**; com real 0, faltam 23; em vermelho), **Previsão de entrega** (data) e **Observações** (texto livre, até 300 caracteres). Estoque desconhecido (item sem registro de estoque, linha de componente do quadro, ou leitura que falhou) mostra "—" e **não** zero. Item já "Peguei" mostra "—" em Falta; sem falta, a Falta mostra 0 e a Previsão "—". O resumo do pedido diz quantos itens têm falta. Sem itens: "Nada para separar neste pedido (só quadro e cabos, ou serviço)". **Conferido.**

### 14.2.5 Botões e controles
A linha expande/recolhe (um pedido por vez); a caixa **Peguei** marca e desmarca; **🖨 Imprimir** expande **todos** os pedidos e abre a impressão do navegador (14.1.5); em cada item, o **estoque real**, a **previsão de entrega** (só quando há falta) e as **observações** gravam ao sair do campo (a data, ao mudar). **Conferido** (código e tela; a falta recalculou ao vivo ao digitar o real). Gravar usa as migrations `20261104140000` (aplicada) e `20261104150000` (estoque real, aplicada em 04/11/2026 e testada em transação desfeita: zero é valor válido, negativo e item inexistente recusados, sem alçada e sem sessão recusados, limpar tudo apaga a linha).

### 14.2.6 Comportamento
Marcar chama `qc_separacao_marcar`; sucesso atualiza a tela; **erro vira aviso** na faixa vermelha e numa mensagem (Art. 9). Com a chave pública (localhost "Dev Admin") a leitura e a gravação são **recusadas** e a tela **avisa** em vez de fingir que gravou ("Esta sessão não tem acesso para gravar. Entre pela sua conta do portal."). Recarrega a cada minuto. **Conferido** (comportamento no localhost; a gravação pela tela com login real **não foi vista**: só o banco foi testado).

### 14.2.7 Dados
**Lê:** a carga de 14.1 (mais o estoque físico: `importacao_varejo_estoque`, `pcp_estoque`); `qc_separacao_itens` por `qc_separacao_listar`; `qc_separacao_previsao` (previsão, observação e estoque real) por `qc_separacao_previsao_listar`. **Grava:** `qc_separacao_itens` (um registro por pedido + item pego) e `qc_separacao_hist` (imutável: "pegou" e "devolveu"), **só** por `qc_separacao_marcar`; `qc_separacao_previsao` e `qc_separacao_previsao_hist` (imutável: "definiu", "alterou", "limpou"), **só** por `qc_separacao_previsao_gravar` (migration `20261104140000`, mesma alçada ver/editar do Peguei). Em 04/11/2026 as duas tabelas estão **vazias**. **Conferido.**

### 14.2.8 Regras e armadilhas
- **O que se separa** (Glossário e PC-4): tudo do pedido **menos** o quadro, os cabos do kit, as matérias-primas (VPMP) e o serviço (VPSVC). A **máquina de tração** entra (decisão do Gelson, 04/11/2026). Item novo no Omie que não seja cabo cai aqui por padrão.
- **O estoque real é anotação, não corrige o Omie:** vale só para a Falta desta tela e fica no histórico (`qc_separacao_previsao_hist`); o ajuste do estoque no Omie continua pelo fluxo de contagem/ajuste (12.1).
- **Falta usa o estoque FÍSICO, não o disponível:** o "reservado" do Omie já inclui a reserva deste próprio pedido (mesma regra da Necessidade do PCP, 13.1). **Limite:** não desconta o que **outros pedidos** também esperam do mesmo estoque (dois pedidos pedindo 10 de um item com 12 em estoque mostram falta 0 nos dois). **Conferido** (pedido 9226351151: VPB-065, 23 pedidos, 14 em estoque, 9 de falta).
- **O servidor confere** que o item existe naquele pedido do Omie antes de gravar; repetir a marca **não duplica** nem gera histórico à toa. **Conferido** (teste em transação desfeita).
- **Quem marca sem a alçada é recusado** ("sem alçada editar"). **Conferido** com uma usuária ativa sem a alçada (Amanda Silva); a primeira rodada do teste usou um e-mail que não era perfil ativo e foi recusada por "sem sessão", o que **não** provava a trava de alçada — por isso foi refeita.
- **As duas contas compartilhadas** (Almoxarifado, Expedição, Produção Corrimão) têm a alçada; quando uma delas marca, o histórico registra o **e-mail da conta**, não a pessoa.

### 14.2.9 Testes
`quadros-pedidos-calc.test.js` cobre a lista de itens de separação e o total. A função `qc_separacao_marcar` foi testada **em transações que se desfizeram**: marcar, repetir, listar, desmarcar, histórico com 2 linhas, item que não é do pedido, **sem sessão** e **sem alçada** (todos recusados). **Não existe** teste automatizado da tela. Cenário: **Dado** o pedido 30614 aberto e a Magda com a alçada, **quando** ela marca o encoder VPB-116, **então** a tela mostra "1 de 12 itens pegos" e "magda.torres · <hora>".

### 14.2.10 Pendências e decisões
- A **gravação pela tela com login real** ainda não foi vista (só o banco foi testado): conferir no primeiro uso.
- A gravação da previsão pela **tela com login real** ainda não foi vista (o banco foi testado: definir, repetir sem duplicar, alterar, listar, limpar, item inexistente, data fora do intervalo, sem alçada e sem sessão, numa transação desfeita; `anon` sem acesso).
- Decidir se a **falta** deve descontar o que outros pedidos já esperam do mesmo estoque (hoje não desconta).
- Ligar o **status da Separação** (pendente, parcial, pronto) à coluna de 14.1.
- Decidir se as contas compartilhadas devem manter a alçada (rastreio por pessoa).

### 14.2.11 Histórico
Criada em 04/11/2026; a gravação do "Peguei" no banco (migration `20261104120000_qc_separacao_itens.sql`) e a concessão da alçada vieram no mesmo dia. **Conferido.**

---

## 14.3 Separação FAB QC

### 14.3.1 O que é
"Separação Fabricação Quadro de Comando": igual à 14.2, mas lista o que **foi para fora** da PV QC e **vai com o quadro**: o **kit** (cabo de manobra e cabos modulares) **mais** os **componentes do quadro** que a proposta mostra dentro do item (inversor, placas, sensores…). Só pedidos que têm kit ou componentes. **Conferido** em `quadros-separacao.jsx` (`QuadrosSeparacaoFabPage`).

**Fora do escopo:** o corte de cabo de aço e cinta (13.10); a lista de materiais completa da OP (13.1).

### 14.3.2 Rota e arquivos
Rota `quadros-separacao-fab`; URL `/quadros-de-comando/quadros-separacao-fab[/<codigo_pedido>]`. Mesmo arquivo e mesma tela comum da 14.2 (`QcSeparacaoTela`); regras em `quadros-pedidos-calc.js` (`itensDoKit`, `lerLinhaComponente`, `componentesDoQuadro`). **Conferido.**

### 14.3.3 Perfil e acesso
O "Peguei" usa a **mesma alçada** da PV QC (`quadros-separacao`, ver/editar), porque os códigos não se repetem entre as duas telas e a função é a mesma. O módulo `quadros-separacao-fab` consta no catálogo de alçadas só como rótulo. **Conferido.**

### 14.3.4 O que a tela mostra
Por pedido: primeiro os **cabos do kit** (rótulo "Cabo do kit", código do item), depois os **componentes do quadro** (rótulo "Componente do quadro", código "VPEL-735A · item 3"). No 30614: **31 linhas** = 9 do kit (VPB-097, 098, 099, 100, 101, 102, 105, 106 e o VPEL-529n de **40 M**) + 22 componentes; total "40 M · 104 PC · 2 UN". **Conferido** (leitura na tela).

### 14.3.5 Botões e controles
Igual à 14.2: expandir a linha, marcar "Peguei", **Imprimir** e gravar a **previsão de entrega**. As colunas **Em estoque** e **Falta** valem para os **cabos do kit** (têm código de estoque); as **linhas de componente do quadro** não têm código de estoque e mostram "—" (a previsão pode ser digitada mesmo assim). **Conferido** (código).

### 14.3.6 Comportamento
Igual à 14.2. **Os componentes só aparecem se o pedido já foi relido pela rotina** depois de 04/11/2026; pedido não relido mostra só o kit. **Conferido.**

### 14.3.7 Dados
**Lê:** `pcp_pedido_itens` (`obs_item` incluído), `qc_separacao_itens`. **Grava:** como a 14.2 (a chave do componente é `<ITEM>#<n>`). **Conferido.**

### 14.3.8 Regras e armadilhas
- **De onde vêm os componentes:** da **observação do item do quadro** no pedido do Omie (`det[].observacao.obs_item`), texto com uma linha por componente separadas por `|` e terminadas pela quantidade ("Suporte para Cabo de Comando de Elevador-**2**Peça (PC)"). O cadastro do produto no Omie **não** tem essa lista (`descr_detalhada` vazia); o espelho `pcp_pedido_itens` não a guardava até a migration `20261104130000`. **Conferido** (pedido 30614 lido no Omie e relido pela rotina; **22 linhas, acentos corretos**). Todos os quadros da etapa 20 de 04/11/2026 têm **22 linhas**.
- **Quantidade do componente = a da linha × o número de quadros do item** (30614 tem 2 quadros: o suporte de cabo, 2 por quadro, vira 4). Decisão minha, **a confirmar com o Gelson** se a proposta já traz a soma.
- **O código `ITEM#n` é a posição da linha** na observação: se alguém reordenar a observação no Omie, as marcas já feitas podem apontar para outra linha. O servidor só confere que a linha `n` existe.
- **Cabo do kit** = descrição que **começa com "Cabo"** (cabo de manobra, cabos modulares BST); regra textual, **não** por lista de códigos: cabo novo de outra marca entra sozinho.
- **Unidades diferentes não se somam:** o cabo de manobra vem em **metros**, os demais em peças (o total mostra "40 M · 104 PC").

### 14.3.9 Testes
`quadros-pedidos-calc.test.js`: o leitor de linha (hífen dentro da descrição, unidade com acento estragado, linha sem quantidade) e `componentesDoQuadro` com as **22 linhas reais** do 30614 (soma 66 = 33 por quadro × 2). A função de banco aceita componente existente e recusa `#4` inexistente, `#0`, `#x` e item sem observação (**Conferido**, transação desfeita). Cenário: **Dado** o pedido 30614 relido pela rotina, **quando** abre a Separação FAB QC, **então** vê 9 cabos e 22 componentes.

### 14.3.10 Pendências e decisões
- **Decidido (Gelson, 04/11/2026):** a quantidade do componente é multiplicada pelo número de quadros do item. **Conferido** (confirmação no chat).
- **Feito (04/11/2026, com o "Confirmo" do Gelson):** **22 OPs de corte** antigas de cabo de manobra (VPEL-529n) e cabos modulares (VPB-097 a 106), que estavam "aguardando", foram **canceladas** (OP-0007-C1, 0021-C1 a C9, 0022-C1 a C4, 0024-C1 a C8). A **OP-0002-C1** (VPEL-529n), que estava **em produção**, foi cancelada em seguida com novo "Confirmo" do Gelson (**23 no total**). **Conferido** (UPDATE com retorno das 22 linhas).
- Quando o pedido ganhar **status de separação**, decidir se kit e componentes têm um status só.

### 14.3.11 Histórico
Criada em 04/11/2026 com os cabos; os componentes vieram no mesmo dia, depois da migration e da publicação da rotina `sync-pcp-pedidos` (v15). **Conferido.**

---

## 14.4 Fabricação QC

### 14.4.1 O que é
A antiga **Evolução da Fabricação do Quadro de Comando** (13.8), **movida em 04/11/2026** para este módulo e renomeada **Fabricação QC**: um cartão por OP de quadro, com as etapas de fabricação flegadas, ocorrências e link público para o operador. **O conteúdo da tela não mudou**; só o lugar, o nome e o caminho. **Conferido** (cartões idênticos, 18 em 04/11/2026).

**Fora do escopo:** a lista de pedidos (14.1); a separação (14.2, 14.3). O Gelson avisou que **vai reestruturar esta tela depois da faxina**.

### 14.4.2 Rota e arquivos
Rota `evolucao-fabricacao` (o **id foi mantido** para não quebrar nada que aponte para ele); URL `/quadros-de-comando/evolucao-fabricacao`. O endereço antigo `/logistica/evolucao-fabricacao` **continua abrindo** (o roteador só olha o 2º segmento) e passa para o novo. Componente `EvolucaoFabricacaoQuadroPage` (`evolucao-fabricacao-quadro.jsx`); dados e regras em `fabricacao-quadro-store.js` e `fabricacao-quadro-calc.js`; **página pública** do operador `fabricacao-quadro.html` + `fabricacao-quadro-app.jsx` (link por token, sem login). **Conferido.**

### 14.4.3 Perfil e acesso
Como a 14.1 (grupo do menu). Desmarcar etapa exige a alçada `fabricacao.editar_status_quadro` ("Edita status da Evolução da Fabricação", rótulo antigo ainda no catálogo). A página pública usa funções por token. **Conferido** (código). **Não verificado** o resto da segurança do chão de fábrica (ver 13, PC-6).

### 14.4.4 O que a tela mostra
Cartões recolhíveis por OP (abrem recolhidos; "Expandir todas/Recolher todas"), com número da OP, pedido do Omie, cliente, vendedor, prazo e SLA em dias úteis, anel de andamento, etapas, ocorrências e fiação. Busca por OP, cliente, nº do pedido do Omie e código em falta; ordenação por prazo, criação, progresso, pedido, cliente e vendedor. **Herdado** de 13.8, **Conferido** nos cartões e no título novo.

### 14.4.5 Botões e controles
Igual a 13.8. **Herdado.**

### 14.4.6 Comportamento
Igual a 13.8. **Herdado.** O percentual de cada cartão é o que a coluna **Fabricação** de 14.1 usa (média por pedido). **Conferido** (OS 1212: 100, 84, 0, 84, 68, 51, 51, 51 e 34 → 58%, igual nas duas telas).

### 14.4.7 Dados
`pcp_ordens` (frente `quadro`), `fabricacao_quadro_itens`, `fabricacao_quadro_status`, `fabricacao_quadro_links` (10), `fabricacao_quadro_ocorrencias`, `fabricacao_quadro_fiacao_*`, `pcp_pedidos`. **Conferido** (nomes e contagens).

### 14.4.8 Regras e armadilhas
- **A tela lista só OPs `aguardando` ou `em_producao`:** OP cancelada ou concluída some (as 14 OPs canceladas em 04/11 saíram dos 25 cartões).
- O texto detalhado das regras (etapas, ocorrência com e sem frente de trabalho, link público) **continua em 13.8** até esta tela ser reestruturada; **não** se repete aqui (Art. 44).

### 14.4.9 Testes
`fabricacao-quadro-store.test.js`, `fabricacao-quadro-calc.test.js`; a rota entra no teste de fumaça. Cenário: **Dado** uma OP de quadro em produção, **quando** o operador flega a etapa pelo link público, **então** o anel do cartão avança. **Herdado.**

### 14.4.10 Pendências e decisões
- **Reestruturar a tela** (pedido do Gelson, depois da faxina).
- **Tutorial desatualizado:** o tutorial da Evolução da Fabricação ainda usa o nome e o menu antigos; passa pela sessão de tutoriais (Art. 46).
- O rótulo da alçada ainda diz "Evolução da Fabricação" (`financeiro.jsx`).

### 14.4.11 Histórico
Criada em 19/10/2026 como Evolução da Fabricação (13.8); movida e renomeada em 04/11/2026. **Herdado/Conferido.**

## 14.5 Calculadora de Cabos

### 14.5.1 O que é
Calculadora do **comprimento do cabo de manobra** do elevador, trazida pelo Gelson em 06/11/2026 (arquivo `CalculadoraCaboManobra.html`) e instalada no hub com o visual do sistema. **Só cálculo na tela: não lê nem grava nada no banco.** **Conferido** (código e tela aberta em 06/11/2026).

**Fora do escopo:** gravar o resultado em OP, pedido ou BOM; outros cabos (cabo de aço, cinta): o nome "Calculadora de Cabos" deixa o lugar para eles, hoje só existe o cabo de manobra; ligar a conta ao BOM do quadro (ver 14.5.10).

### 14.5.2 Rota e arquivos
Rota `quadros-calculadora-cabos`; URL `/quadros-de-comando/quadros-calculadora-cabos/mrl` ou `/mr` (o tipo de elevador mora na URL: recarregar e compartilhar o link mantém a escolha; `mrl` é o padrão). Tela `calculadora-cabos.jsx` (`CalculadoraCabosPage`); conta pura em `calculadora-cabo-manobra-calc.js` (`window.CaboManobraCalc`), com teste em `calculadora-cabo-manobra-calc.test.js` (5). Menu, título e caminho em `shell.jsx` e `app.jsx`; rota em `router.js`. **Conferido.**

### 14.5.3 Perfil e acesso
Como as outras telas do grupo: quem vê "Quadros de Comando" no menu abre a tela. Módulo `quadros-calculadora-cabos` no catálogo de alçadas, só para constar; **a tela não grava, então não há ação que exija alçada**. **Conferido** (código).

### 14.5.4 O que a tela mostra
À esquerda, os campos: tipo de elevador (MRL / com casa de máquinas), paradas (padrão 9), piso a piso em metros (3,0), profundidade do poço P (1,5), overhead K (4,5) e, conforme o tipo, margem de travessia MRL (2,0) **ou** distância do quadro ao furo da laje (4,0). À direita, o resultado: curso total, seio, percurso na cabine, parcela do tipo, **comprimento total** e **comprar (arredondado)**. Embaixo dos campos, as constantes fixas. **Conferido** (padrão MRL: 41,82 m → comprar 42 m; MR: 43,82 m → 44 m).

### 14.5.5 Botões e controles
Dois botões de tipo de elevador (trocam a URL) e os campos numéricos. Sem botão de salvar nem de imprimir. **Conferido.**

### 14.5.6 Comportamento
O resultado muda **enquanto se digita**. Erro de entrada aparece **no lugar do resultado**, nunca como número: menos de 2 paradas, ou poço de 15 cm ou menos. **Conferido** (teste de unidade).

### 14.5.7 Dados
Nenhum (não lê nem grava tabela). **Conferido.**

### 14.5.8 Regras e armadilhas
- **Conta (portada sem mudar do HTML original):** curso = (paradas − 1) × piso a piso; seio = 2 × (P − 0,15) + π × (P − 0,15) / 2; percurso na cabine = 1,50 + 3,00 + 2,00; total = curso + K + seio + cabine + (MRL: margem | MR: distância ao furo); comprar = total arredondado **para cima**, em metros inteiros. Constantes fixas no código: cabine 1,50 × 3,00 m, sobra do topo 2,00 m, folga do seio no fundo 15 cm. **Conferido.**
- **Esta conta NÃO é a do cabo de manobra do BOM do quadro** (`montarTrechoCaboManobra`, 4.1, calibrada num cabo real: 10 paradas × 3 m = 47 m). Para o mesmo caso (10 paradas, piso 3 m, MRL, valores padrão) esta calculadora dá **44,8 m → 45 m**. **Achado, sem correção:** as duas contas coexistem até o Gelson decidir qual vale. **Conferido** (cálculo).

### 14.5.9 Testes
`calculadora-cabo-manobra-calc.test.js`: padrão MRL confere com a planilha original; MR troca a margem pela distância ao furo; aceita texto dos campos; valida paradas e poço; arredondamento para cima. Cenário: **Dado** 9 paradas, 3 m, poço 1,5, K 4,5 e margem 2, **quando** se calcula, **então** o total é 41,82 m e a compra é 42 m. A rota entra no teste de fumaça sozinha. **Conferido** (suíte 1070/1070 em 06/11/2026; tela aberta no navegador, MRL e MR).

### 14.5.10 Pendências e decisões
- **Decidir qual conta de cabo de manobra vale** (esta ou a do BOM, 14.5.8) e, se for esta, ligá-la ao BOM do quadro.
- Outros cabos (aço, cinta) nesta calculadora: não pedido.
- Tutorial: não existe (Art. 46); ajuda do "?" não criada.

### 14.5.11 Histórico
Criada em 06/11/2026 a pedido do Gelson. **Conferido.**

---

# Parte comum de Quadros de Comando

## PC-1 Mapa de ligações e fios desligados
**Herda de:** o Omie (pedidos de venda e Ordens de Serviço, lidos a cada 30 minutos por `sync-pcp-pedidos` e `sync-pcp-os`; só leitura), o PCP (as OPs de quadro, 13.1). **Doa para:** as Etiquetas (12.4), que leem `quadros_comando` (Formulário ilhado) e as OPs de quadro; o número de série em `mes_ordens` **deixou de ser lido** (PC-11). **Selo:** Conferido.

**Fios desligados em 04/11/2026** (decisão do Gelson; **nada foi apagado**, só saiu do caminho do usuário):
- **Formulário do Quadro de Comando ilhado:** o card no hub Formulários virou "Em breve" e o item de menu "Cotação Quadro de Comando" saiu; as telas, as tabelas (`quadros_comando` e filhas) e o **link público** continuam existindo. Será ligado dentro do Omie e **criará o pedido de venda sozinho** (futuro). O link público e a função `capturar-lead-quadro-comando` **ainda criam lead no hub** (fio aberto, pendente de decisão).
- **MES e MES · Cadastros saíram do produto:** menu, rotas, scripts e entradas de alçada removidos; os arquivos `mes*.jsx` e as tabelas `mes_*` **ficam** até haver "Confirmo" para apagar (**1** OP, **3** execuções e **8** registros de histórico em 04/11/2026). A Fabricação QC é o acompanhamento que vale.
- **PCP:** saiu a aba **Pedidos de Quadro** e o botão **Enviar para Pedidos de Quadro** (criava `quadros_comando` redundantes). O **Gerar OPs** do pedido **continua** (é o único jeito de criar a OP até existir a entrada automática).
- **Separação (Logística):** saiu o botão **Quadro de Comando** dos itens "Na operação".
- **Corte:** passou a tratar **só cabo de aço e cinta de tração**; cabo de manobra e cabos modulares foram para a Separação FAB QC (14.3).

## PC-2 Do Omie à fábrica: o que é um "quadro"
Hoje existem **dois** registros que se chamam "quadro", e é essa a ambiguidade que o módulo veio acabar. **A.** `quadros_comando` (+ 10 tabelas filhas): o **formulário técnico** (paradas, geometria, BOM calculada, cruzamento com o estoque), que nasce da **pré-venda** (Formulário, link público, Cotação): **7** ativos e **81** excluídos. **B.** a **OP de quadro** (`pcp_ordens`, frente `quadro`): nasce do **pedido do Omie**: **25** no total, **18** ativas. **As 18 OPs ativas vindas do Omie não usam o registro A** (`quadro_comando_id` vazio): o que vem do Omie já vive só no B; a BOM da OP é a estrutura do Omie (`pcp_estrutura`, ~68 componentes). O registro A só serve ao fluxo de pré-venda, hoje ilhado. **Conferido** (contagens em 04/11/2026).

**Desenho-alvo (Herdado da conversa de 04/11/2026, ainda não construído):** o pedido com quadro chega à etapa 20 → o módulo cria as OPs de quadro (uma por quadro físico) → a Separação PV QC e FAB QC e a Fabricação QC se alimentam → as Etiquetas leem daqui.

## PC-3 Rotas, páginas públicas e arquivos
Rotas: `/quadros-de-comando/quadros-calculadora-cabos[/mrl|/mr]` (14.5), `/quadros-de-comando/quadros-pedidos`, `/quadros-de-comando/quadros-separacao[/<pedido>]`, `/quadros-de-comando/quadros-separacao-fab[/<pedido>]`, `/quadros-de-comando/evolucao-fabricacao`. Páginas públicas: `fabricacao-quadro.html` (14.4) e **`quadros-publico.html`** (05/11/2026, pedido do Gelson), uma só página em `/quadros-publico/<tipo>/<token>`: `pedidos` (gestores: status da fabricação e da separação, **só leitura**), `separacao` (separador, pelo celular, marca **Peguei** na Separação PV QC) e `separacao_fab` (idem na Separação FAB QC). Cada tipo tem **um link secreto** (64 caracteres), criado e **trocável** pelo botão "🔗 Link público" das três telas internas (ver exige a alçada `quadros-separacao.ver`; criar/trocar, `editar`); trocar invalida o link antigo. No celular o separador **digita o nome** (guardado no aparelho) e cada "Peguei" fica gravado como `link: <nome>`; o link **não** grava estoque real, previsão nem observações (decisão do Gelson). A página usa os **mesmos cálculos** da tela interna (`QuadrosPedidosStore.montar`), então os números batem. Arquivos: `quadros-publico.html`, `quadros-publico.jsx`; rota em `server.js`; entrada em `PAGINAS_PUBLICAS` do e2e. **Conferido** (código e página abrindo com token falso; a leitura e o "Peguei" por link **dependem da migration `20261105100000`, ainda não aplicada**). Arquivos do módulo: `quadros-pedidos.jsx`, `quadros-pedidos-store.js`, `quadros-pedidos-calc.js` (+ `quadros-pedidos-calc.test.js`), `quadros-separacao.jsx`, `evolucao-fabricacao-quadro.jsx`, `fabricacao-quadro-store.js`, `fabricacao-quadro-calc.js`, `fabricacao-quadro-app.jsx`. Compartilhados que mudaram: `shell.jsx` (menu, apelido do grupo), `router.js` (`KNOWN_ROUTES`), `app.jsx`, `colaboradores-admin-store.js` (alçadas), `server.js` (`SPA_MODULES` ganhou `quadros-de-comando`). **Conferido.**

## PC-4 Regras de negócio que atravessam as telas
- **Classificação de cada linha do pedido** (`QuadrosPedidosCalc.classificarItem`): **quadro** (código de variante ou produto da OP de quadro do pedido), **materia_prima** (código `VPMP…`), **servico** (código `VPSVC…`), **cabo** (descrição começa com "Cabo": vai com o quadro) e **separacao** (o resto). **Conferido.**
- **O Omie repete a linha com quantidade 0** (pedido 29972): somar por código e ignorar o que ficar em zero **antes** de contar linhas ou somar unidades. **Conferido.**
- **Total por unidade de medida:** metro e peça nunca se somam (30614: "40 M · 104 PC · 2 UN").
- **Número que manda é o do Omie;** o número da OP e o do pedido de quadro interno são detalhe.
- **Ordem de Serviço** (cliente de licitação, só serviço): vira uma linha "OS"; o item é o serviço (`VPSVC-033`, 9 quadros na OS 1212); **não tem o que separar**; o andamento é a média das OPs-filhas. **Conferido.**
- **OP sem pedido de venda não entra** na lista (14.1.8). **Conferido.**

## PC-5 Quem faz o quê (alçadas)
Catálogo (`CATALOGO_MODULOS`): `quadros-pedidos`, `quadros-separacao` e `quadros-separacao-fab`; o grupo do menu "Quadros de Comando" (`MODULOS_POR_GRUPO_SIDEBAR`) cobre os três. **Só a Separação grava e exige alçada no banco** (`quadros-separacao` ver/editar, 9 perfis em 04/11/2026). A Fabricação QC mantém `fabricacao.editar_status_quadro`. O Administrador passa em tudo. **Conferido.**

## PC-6 Identidade e segurança
`qc_separacao_itens` e `qc_separacao_hist` **nasceram fechadas** (Art. 26): RLS ligada, sem acesso para `anon` nem `authenticated`; só as funções `qc_separacao_listar` e `qc_separacao_marcar` (`SECURITY DEFINER`, executáveis só por `authenticated`, nunca por `anon`/`public`), que exigem **usuário ativo** e a **alçada**. Histórico imutável (Art. 27). **Conferido** (`pg_class`, `has_table_privilege`, `has_function_privilege`). As telas de leitura (14.1, 14.4) usam as tabelas do PCP, **abertas à chave pública** (achado de 13.1.8; Art. 25: trava de tela é organização, não segurança).

## PC-7 Rotinas, funções e crons
- **`sync-pcp-pedidos` (v15, publicada em 04/11/2026 com o "Confirmo" do Gelson):** lê pedidos do Omie (só leitura) e grava `pcp_pedidos`/`pcp_pedido_itens`, agora **com a observação do item** (`obs_item`). Crons: `sync-pcp-pedidos-etapa20` (`0,30 10-22 * * 1-5`, UTC), `sync-pcp-pedidos-abertos` (`10,40`), `sync-pcp-pedidos-previsao-etapa10` (`20`) e `pcp-pedidos-tirar-etapa10` (`20 * * * *`). **Risco registrado:** não foi possível comparar o código em produção (v14) com o do repositório; a data do último commit (22/10, 17:51) bate com a da v14 (17:54), mas **não está provado** que eram iguais.
- **`sync-pcp-os`:** lê as Ordens de Serviço (a OS 1212 vem daqui). **Herdado.**
- **Nenhum cron novo** foi criado para este módulo. **Conferido** (`cron.job`).

## PC-8 Tabelas
**Links públicos (05/11/2026, migration `20261105100000`):** `qc_publico_links` (um token por tipo; fechada) e as funções `qc_publico_link_obter` (logado, com alçada), `qc_publico_dados` e `qc_publico_peguei` (estas duas executáveis por `anon`, **só com token válido**; `qc_publico_dados` devolve o que a tela interna lê, **inclusive nome do cliente e do vendedor** — o link dá acesso a isso a quem o tiver). **Conferido** em 05/11/2026 (migration aplicada com "Confirmo"; transação desfeita): `anon` não lê a tabela nem executa `qc_publico_link_obter`/`_qc_dados_brutos`; token curto/inválido devolve nulo; link `pedidos` recusa "Peguei"; nome com 1 letra e item fora do pedido são recusados; "Peguei" e "devolver" gravam `link: <nome>` em `qc_separacao_itens`/`qc_separacao_hist` e a leitura mostra o item pego. **Não verificado:** `qc_publico_link_obter` com sessão real (alçada ver/editar) e a página aberta no celular.
**Novas (04/11/2026):** `qc_separacao_itens`, `qc_separacao_hist`, `qc_separacao_previsao` e `qc_separacao_previsao_hist` (estas duas nas migrations `20261104140000` e `20261104150000`, aplicadas em 04/11/2026 com o "Confirmo" do Gelson; a segunda acrescenta o estoque real); coluna nova `pcp_pedido_itens.obs_item`. **Lidas:** `pcp_pedidos`, `pcp_pedido_itens`, `pcp_ordens`, `pcp_quadro_variante`, `fabricacao_quadro_*`. **Ilhadas (formulário):** `quadros_comando` e suas filhas. **Fora do produto, com dado:** `mes_*` (PC-1). **Conferido.**

## PC-9 Navegação, cache e testes
Aba e item na URL (`useRotaId`); `?v=` obrigatório (Art. 19). **O verificador local `check-cache-bust.js` só enxerga o que já foi commitado:** antes do commit, conferir à mão que cada arquivo alterado tem `?v=` acima do de `origin/main` (inclusive `fabricacao-oficina.html`, que carrega o cálculo do Corte). Testes do módulo: `quadros-pedidos-calc.test.js` (12); a suíte passou **991/991** em 04/11/2026. **Sem teste:** as quatro telas e a carga de dados. **Conferido.**

## PC-10 Menu "?" e tutoriais
Não há tutorial do módulo. O tutorial da Evolução da Fabricação está desatualizado (nome e menu); a sessão de tutoriais regenera, não se edita o HTML à mão (Art. 46). **Não verificado** o estado atual das pastas de tutorial.

## PC-11 Documentos soltos e destino do que foi concatenado
Seções do `CLAUDE.md` e de `docs/` que tratam de quadro de comando e **ainda não foram concatenadas** aqui (Art. 50): "Quadro de Comando — BOM lê a estrutura do produto no Omie", "Quadro de Comando — formulário público v2…", "Quadro de Comando — fases padrão 3, chicotes VPEL automáticos e fio até a UA", "Evolução da Fabricação do Quadro…" e "Fabricação Corrimão + Fabricação Corte…" (parte do quadro) — o conteúdo vive em **4.1/4.4** (formulário e BOM) e **13.1/13.8** (PCP e Evolução); a migração para este módulo é um próximo passo, **sem urgência**. **Nada foi apagado.** **Etiquetas religadas (04/11/2026, decisão do Gelson):** a etiqueta de OP/série **deixou de ler `mes_ordens`**; o número de série passa a ser o que se digita na tela de etiqueta (campo editável), até a Fabricação QC guardar a série da OP (coluna nova exigiria migration e "Confirmo"). A lista de pedidos de quadro para chicote ainda lê `quadros_comando` (Formulário ilhado, 7 ativos) **e** as OPs de quadro; o que vem do Omie já entra pelas OPs. Com isso nada do produto depende mais de `mes_*`: apagar esses dados só precisa do "Confirmo". **Conferido** (código; `mes_ordens` tinha 1 linha, sem série).

## PC-12 Benefícios trocados com os outros módulos
**Recebidos:** de Administração — tabela nova nasce fechada, com acesso só por função com alçada (15, PC-4); de Fabricação — telas duplicadas criam duas verdades (13, PC-12); de Serviços — título de aviso curto, com o essencial na frente (16, PC-2). **Doados (Art. 49):** (a) o Omie repete linha de item com **quantidade 0**: somar por código e ignorar o zero antes de contar; (b) **metro e peça nunca se somam**: total por unidade; (c) caixa de tabela com a **altura da janela**, para a barra de rolagem lateral ficar à vista; (d) função de banco nova se testa **numa transação que se desfaz** (bloco `do $$ … raise exception`), incluindo um usuário ativo **sem** a alçada, para provar a recusa e não só "sem sessão"; (e) a **observação do item** do pedido do Omie (`obs_item`) guarda o que a proposta mostra dentro do item. Cada um dos outros 15 documentos de módulo recebeu, em 04/11/2026, o bullet "Recebido de Quadros de Comando" no seu PC-12 (no `01_geral.md`, antes do primeiro bullet de benefícios). **Conferido.**
