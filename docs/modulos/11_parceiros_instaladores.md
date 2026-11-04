# 11 Parceiros & Instaladores — documento do módulo (REAL, fonte da verdade — 01/11/2026)

> **Status: REAL (documento oficial do módulo 11), aprovado pelo Gelson em 01/11/2026**, no molde de `01_geral.md` a `10_entrega_documentacao.md`. Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que este módulo pede cuidado:** é onde a empresa lida com **terceiros que mexem em obra e em dinheiro** — o cadastro do montador (com CPF, RG, CNH e dados bancários), a prova de que ele pode trabalhar (documentos com validade), o **contrato** que ele assina e as **parcelas que a empresa paga**. Três coisas pedem atenção: (1) quase todas as tabelas do módulo estão **abertas à chave pública** do banco, inclusive as que guardam dado pessoal e bancário e as parcelas a pagar (PC-6); (2) a **homologação** grava "válido/vencido" no dia em que o documento é salvo e **nunca mais reavalia** (11.2.8); (3) há **dois caminhos de pagamento** — as parcelas do Contrato (com aprovação do Gestor Comercial) e o Cronograma de Pagamento (manual, sem aprovação, hoje vazio) — e um terceiro dado, o **título do Omie**, que só é lido (PC-4).
>
> **Fonte da verdade:** o código e o banco, conferidos em 01/11/2026 (`origin/main` `e53dfa8`). **Conferido** = lido no código ou consultado no banco (só SELECT) nesta data; **Herdado** = veio do `CLAUDE.md`, de uma migration/spec ou do documento de outro módulo e **não** foi reconferido; **Não verificado** = não consegui confirmar. Sem selo vale como Não verificado (Art. 6).
>
> **Escopo do módulo:** as **cinco** telas do grupo "Parceiros & Instaladores" do menu (`NAV_GROUPS` em `shell.jsx`): **Empresas Instaladoras**, **Homologação de Instaladores**, **Contrato Instalador**, **Pagamentos a Instaladores** e **Cronograma de Pagamento da Instalação**. Pertencem a elas, sem item de menu: a página pública do **recibo** (`/recibo/<token>`) e, no Contrato, o **distrato** e a **fila de assinaturas internas**. **Não** são deste módulo: vincular a empresa a uma obra e o **Diário de Obra** que dispara a liberação das parcelas (9.1); a **ART** (9.6); a **Evolução dos Equipamentos** (9.5); a página `/assinar/<token>` em si e a regra de assinatura digital (6, PC-3); a Central de Decisões onde Juliana e o Gestor Comercial respondem (1.3); a tabela de **Atualização de Custos** que dá o valor de tabela (5.1).
>
> **Onde moram arquivos que não têm nome óbvio (Conferido):** "Empresas Instaladoras" é `cadastro-instaladores.jsx`, mas os **formulários de empresa** (`ModalNovoMontador`) e a **leitura/gravação** vêm de `rh-homologacao.jsx` e `rh-homologacao-store.js` (`window.RHHomologacao`); o Cronograma é `CronogramaPage` **dentro de `entrega.jsx`** (arquivo que também guarda o Data Book, do 10); as abas "Preços combinados" e "Recibos" são arquivos próprios (`pagamentos-instalador-acordos.jsx`, `pagamentos-instalador-recibos.jsx`); o Contrato Instalador tem a tela em `contrato-instalador.jsx` (2.462 linhas), o texto em `contrato-instalador-engine.js` e o cartão no Dossiê em `dossier-obra.jsx`.

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md`. Aqui vale a mesma: módulo = **11**; telas filhas = **11.1 a 11.5**, na ordem do menu; o conteúdo comum fica na **Parte comum**, sem número de tela.
- **Tudo o que é janela, aba, gaveta ou assistente de uma tela pertence a ela.** No 11.3 estão o assistente de 6 passos, o painel, a gaveta de auditoria, o pedido de aval, a nova revisão, a anulação e o distrato. No 11.4 estão as três abas (Parcelas, Preços combinados, Recibos) e a página pública do recibo.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
11. **Parceiros & Instaladores**
   11.1 Empresas Instaladoras · 11.2 Homologação de Instaladores · 11.3 Contrato Instalador (assistente, painel, aval, assinaturas, revisões, anulação, distrato) · 11.4 Pagamentos a Instaladores (Parcelas, Preços combinados, Recibos e a página pública do recibo) · 11.5 Cronograma de Pagamento da Instalação
   &nbsp;&nbsp;&nbsp;Cada tela tem os temas: x.1 O que é · x.2 Rota e arquivos · x.3 Perfil e acesso · x.4 O que a tela mostra · x.5 Botões e controles · x.6 Comportamento · x.7 Dados (lê/grava) · x.8 Regras e armadilhas · x.9 Testes · x.10 Pendências e decisões · x.11 Histórico
   Parte comum de Parceiros & Instaladores (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 O montador de ponta a ponta · PC-3 Rotas, páginas públicas e arquivos · PC-4 Os "valores" do montador (e por que não se confundem) · PC-5 Quem aprova o quê · PC-6 Identidade, alçadas e segurança · PC-7 Gatilhos, eventos, crons e funções · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
12. Logística Interna → `12_logistica_interna.md` (REAL)

## Glossário (módulo Parceiros & Instaladores)
Termos gerais (alçada, soft-delete, evento de fluxo, Nº da cotação) estão em `01_geral.md`; **Dossiê da Obra**, **codigo_obra** e **ART** em `09_obras_instalacao.md`; a **página de assinatura** em `06_contratos_juridico.md`. Não se repetem aqui.
- **Montador / instalador / parceiro instalador:** a **empresa** (PJ) que monta o equipamento na obra. A pessoa que vai à obra é o **colaborador**. No banco a empresa é `parceiros_instaladores` (id `MNT-xxxxxx`).
- **Colaborador:** pessoa física de uma empresa instaladora (`parceiros_colaboradores`, id `COLAB-xxxxxxxx`). "Proprietário" ou "Sócio" no vínculo = responsável legal.
- **Homologação:** hoje significa **documentação em dia**: cada colaborador tem os documentos obrigatórios do catálogo e nenhum vencido. **Não** é a coluna `homologado` da empresa (que ninguém lê, 11.2.8).
- **Catálogo de documentos:** `parceiros_doc_catalogo`, 87 tipos em três escopos: colaborador (43), empresa (22) e obra_compliance (22).
- **Preço combinado (acordo):** o valor **fechado** com o montador por equipamento/Dossiê (`instalador_acordos`). O Contrato herda; a tabela de Atualização de Custos (5.1) é só referência.
- **Contrato Instalador:** o contrato de prestação de serviço assinado pela **Contratada** (o montador) e por **três** assinaturas internas (Diego, Juliana, Maurício), em qualquer ordem. Número `VPNI-<Nº da cotação>` (PC-4).
- **Aval do montador:** a **Juliana** responde SIM ou NÃO por WhatsApp antes de o contrato ser enviado. No banco o tipo da decisão ainda se chama `contratacao_mao_obra_ceo` (nome de quando o aval era do CEO) e o papel é `aval_instalador`.
- **Parcela (do Contrato):** fatia do valor, liberada por marco da obra (início, metade, conclusão) ou à mão; só vira "paga" depois da aprovação do Gestor Comercial.
- **Recibo:** comprovante de pagamento ao montador que **ele assina** por link. O de tipo "adiantamento" assinado **abate** as parcelas na tela.
- **Distrato:** rescisão bilateral de um Contrato **já assinado**, com assinatura própria da Contratada e ciência da fila interna.
- **Anular assinatura:** desfazer, sem apagar, um contrato enviado ao montador errado; o contrato vira `expirado` e pode ganhar link novo.
- **Cronograma de Pagamento:** controle paralelo e **manual** de 4 fases de pagamento por equipamento (`instalacao_cronograma`), sem ligação com o Contrato.
- **Título do Omie (pagamento):** conta a pagar lida do Omie e guardada em `omie_pagamentos_cache`; é o que a tela "Empresas Instaladoras" mostra como "pago".

---

## 11.1 Empresas Instaladoras

### 11.1.1 O que é
O **cadastro** das empresas montadoras e de seus colaboradores, com um olhar de "vida da instaladora": para cada empresa, **quais clientes e obras ela atende** e **quanto o Omie já pagou**. **Conferido** em `cadastro-instaladores.jsx` (567 linhas) e `rh-homologacao-store.js` (488), 01/11/2026.

**Fora do escopo:** documentos com validade (11.2); vincular a empresa a uma obra (aba/roster no Dossiê, 9.1 — aqui só se **desvincula**); contratar e pagar (11.3 e 11.4); cadastro de cliente e fornecedor (3).

### 11.1.2 Rota e arquivos
Rota `cadastro-instaladores`; URL `/cadastros/cadastro-instaladores[/<id da empresa>]` — a empresa aberta vive na URL (`useRotaId`), então F5 e link direto reabrem a certa; também é por esse link que a Central de Decisões abre "Ver documento" de uma decisão de montador. Arquivos: `cadastro-instaladores.jsx` (`window.CadastroInstaladoresPage`) e, para o formulário de empresa, `ModalNovoMontador` em `rh-homologacao.jsx`. Dados por `window.RHHomologacao` e `window.OmiePagamentosStore`. **Conferido.**

### 11.1.3 Perfil e acesso
O módulo de alçada `cadastro-instaladores` existe (ver 12, criar 3, editar 3, excluir 2 pessoas, 01/11/2026), mas **a tela não lê nenhuma alçada**: quem abre vê e usa todos os botões, inclusive **Excluir**. O item de menu não tem `restrict`. **Conferido** (arquivo lido por inteiro). **Achado, sem correção.**

### 11.1.4 O que a tela mostra
"Cadastros · Empresas Instaladoras" com busca por nome ou CNPJ e três colunas:
- **Empresas:** um cartão por empresa (nome, id, CNPJ, e-mail ou telefone), com **👥 Funcionários**, **🛗 Elevadores** (conta Dossiês distintos, unindo os três vínculos possíveis), **⚠ N doc(s) vencido(s)** (link para a Homologação) e **💰 Pagamentos** (pago e previsto, só de títulos do Omie já ligados a uma obra).
- **Colaboradores** da empresa escolhida (CPF ou CNH, status quando não é "Ativo").
- **Clientes atendidos:** árvore Cliente → obra/equipamento, cada obra com marcos técnicos do Diário, a "planilhinha" de parcelas do Omie (sempre **4 linhas**: Entrada, 2ª, 3ª, 4ª), a barra **💰 pago × 🏗️ obra**, um aviso de dinheiro à frente ou atrás da obra e o selo de situação ("Obra Concluída" só com Diário 100% **e** parcelas do contrato todas pagas). Abaixo, um aviso amarelo com o valor do Omie **sem obra vinculada**.

### 11.1.5 Botões e controles
**Nova empresa**; ✎ e 🗑 por empresa; **Novo colaborador**, ✎ e 🗑 por colaborador; 🗑 por obra ("Desvincular"); **Atualizar pagamentos (Omie)** (com "Última sinc."); busca; clique na obra abre o Dossiê (`setSubsel` + `setRoute`). **Conferido.**

### 11.1.6 Comportamento
- **Salvar empresa** (`salvarMontador`): tenta `insert` e, se o id já existe (erro 23505), faz `update`. O id novo é `MNT-` + os 6 últimos dígitos do relógio. Só o **nome** é obrigatório; **CNPJ não é validado** (nem dígito verificador, nem unicidade na tela).
- **Excluir empresa/colaborador** é **físico** (`delete`), com `confirm`. Empresa com colaborador, documento de empresa ou vínculo a Dossiê/equipamento **não apaga** (chaves estrangeiras sem cascata) e o erro aparece num aviso; empresa **sem** esses vínculos apaga, mesmo com Contrato, preço combinado ou recibo (esses guardam o nome e o CNPJ **como texto**, sem chave). Excluir colaborador apaga antes os documentos dele; os **arquivos** no depósito não são removidos.
- **Desvincular** zera os três vínculos (obra principal, roster e equipamento) de uma vez.
- **Atualizar pagamentos** chama a Edge Function `omie_sync_pagamentos_instaladores` (lê o Omie, só leitura) e recarrega o cartão; o mesmo roda sozinho **todo dia às 06:00 de Brasília** (PC-7). **Conferido.**

### 11.1.7 Dados
**Lê/grava:** `parceiros_instaladores` (31), `parceiros_colaboradores` (63), `dossier_obra.parceiro_instalador_id` (25 Dossiês), `dossier_obra_instaladores` (2), `equipamentos_obra.parceiro_instalador_id`. **Lê:** `omie_pagamentos_cache` (740), `omie_pagamentos_sync_log` (189), documentos de colaborador (resumo), Diário (progresso). Das 31 empresas, **3** têm banco ou PIX preenchido e **5** não têm CNPJ; dos 63 colaboradores, **24** não têm CPF; **nenhum** CNPJ nem nome de empresa está repetido. **Conferido** por `count(*)`, 01/11/2026.

### 11.1.8 Regras e armadilhas
- **Dado pessoal e bancário aberto à chave pública (achado, sem correção):** `parceiros_instaladores` (CNPJ, contato, **banco, agência, conta, PIX**) tem leitura, inclusão, alteração e **exclusão** liberadas ao papel `public`; `parceiros_colaboradores` (**CPF, RG, CNH**, endereço) tem `ALL` para `anon`. Quem tem a chave pública do app lê e altera. Ver PC-6. **Conferido** (`pg_policies`).
- **Exclusão física de cadastro com histórico (achado, sem correção):** o Art. 16 cobre só cliente e fornecedor; empresa instaladora e colaborador **não** têm trava de "tem transação". O que protege hoje são as chaves estrangeiras, que não alcançam Contrato, acordo e recibo (11.1.6). **Conferido.**
- **Falha silenciosa ao desvincular (achado, sem correção):** `desvincularDaObra` faz três gravações em paralelo e **não olha o erro de nenhuma**; se falhar, a tela diz "Vínculo removido." (Art. 9). **Conferido.**
- **Leituras que falham viram "vazio"** (`listarMontadores` e vizinhas ignoram `error`): a lista aparece vazia sem aviso. **Conferido.**
- **Duas contas de pagamento que não se cruzam:** a tela mostra os **títulos do Omie** em 4 linhas fixas; o Contrato tem 2, 3 ou parcelas personalizadas (11.3, 11.4). O selo "Obra Concluída" usa as parcelas **do Contrato**, das quais **nenhuma** está paga em produção (11.4.7), então o selo não aparece por esse caminho. **Conferido.**
- **Vínculo título do Omie ↔ obra:** é automático (nº de série no documento ou nome do projeto) e, quando falha, só se corrige **por SQL** na tabela `omie_pagamentos_vinculo_manual` (21 linhas, **sem tela**; o gatilho a reaplica a cada sincronização). **Conferido.**
- **Empresa nova cai direto no Contrato:** o assistente do Contrato lista estas empresas e pré-preenche CNPJ, endereço e banco (11.3).

### 11.1.9 Testes
Nenhum teste de unidade dedicado; a rota entra no **teste de fumaça** (`KNOWN_ROUTES`) — **não rodei** o e2e. **Cenários (sem teste):** *Dado* uma empresa com colaboradores e uma obra vinculada, *quando* abro a empresa pelo link, *então* aparecem colaboradores e a árvore de clientes. *Dado* uma empresa sem vínculo, *quando* excluo, *então* ela some e a lista recarrega.

### 11.1.10 Pendências e decisões
**Decisão do Gelson:** (a) a tela deve ler a alçada `cadastro-instaladores` (editar/excluir)? (b) trocar a exclusão física por "inativar" quando houver Contrato, acordo ou recibo (extensão do Art. 16)? (c) validar o CNPJ por dígito e impedir repetido? (d) fechar `parceiros_*` à chave pública é assunto da #571 (PC-6). Tratar o erro do "Desvincular" e das leituras.

### 11.1.11 Histórico
Nasceu como "cadastro raso" separado da Homologação (mesma tabela, 25/08); ganhou colaboradores e endereço, depois a aba "Clientes atendidos" com pagamentos do Omie (04/09), o selo "Obra Concluída" (01/09) e os dados bancários que alimentam o Contrato (01/09). **Herdado** (comentários do código).

---

## 11.2 Homologação de Instaladores

### 11.2.1 O que é
A tela de **conformidade documental**: Empresa → Colaborador → Documentos, com **data de vencimento** por documento. É dela que sai a pergunta "este montador pode entrar na obra?". **Conferido** em `rh-homologacao.jsx` (452 linhas) e `rh-homologacao-store.js`.

**Fora do escopo:** cadastro da empresa e do colaborador (11.1); documentos **da obra** (Dossiê, 9.1; Central de Documentos, 10.1); a decisão "montador entra na obra" (PC-5).

### 11.2.2 Rota e arquivos
Rota `rh-homologacao`; URL `/rh/rh-homologacao[/<id da empresa>]` (a empresa aberta vive na URL). Arquivos: `rh-homologacao.jsx` (`window.RHHomologacaoPage`, que também define `ModalNovoMontador` e `ModalDocumentoColaborador`) e `rh-homologacao-store.js`. O menu a coloca em "Parceiros & Instaladores", mas o caminho do topo ainda diz **RH Operacional**. **Conferido.**

### 11.2.3 Perfil e acesso
Alçada `rh-homologacao` existe (ver 12, criar 6, editar 6, excluir 2), mas **a tela não lê alçada**. Há uma linha no "?" (`HELP_TOPICS`). **Conferido.**

### 11.2.4 O que a tela mostra
Quatro cartões (**Empresas**, **Documentos vencidos**, **Documentos válidos**, **Sem vencimento (N/A)**), busca e três colunas: empresas (com selos "N vencidos / N válidos"), colaboradores e documentos do colaborador (✅ válido, ❌ vencido, ⏳ sem data; vencimento, "abrir documento", observação).

### 11.2.5 Botões e controles
Busca; clique na empresa (muda a URL), no colaborador; **Adicionar** documento; ✎ editar documento. No formulário: tipo (só o catálogo do escopo colaborador), data de vencimento, arquivo (PDF ou imagem), observação. **Carteira de Vacinação** (DOC-080) abre uma lista de 7 vacinas, cada uma com data opcional. **Conferido.**

### 11.2.6 Comportamento
- **Status** = `statusPorData`: sem data → `N/A`; data anterior a hoje → `VENCIDO`; senão `VALIDO`. É calculado **ao salvar** e gravado na coluna `status`.
- **Arquivo** vai ao depósito `parceiros-instaladores-anexos` (`colaboradores/<colaborador>/<documento>.<ext>`, substitui o anterior); "abrir documento" gera link assinado de 1 hora.
- A **carteira de vacinação** grava várias linhas (a carteira e uma por vacina marcada).
- **Homologação "ok"** (`statusGeralPorColaboradores`): a empresa tem ao menos um colaborador, todos têm **todos** os documentos obrigatórios do escopo colaborador (24 tipos) e nenhum está `VENCIDO`; estados `vazio`, `expirado`, `incompleto`, `ok`. Faz uma consulta **por colaborador**. É usada pelo aviso do Contrato e pelo portão "obra pronta para instalação" (9). **Conferido.**

### 11.2.7 Dados
`parceiros_documentos_colaborador` (520: VÁLIDO 312, N/A 159, VENCIDO 49; **494** com arquivo), `parceiros_doc_catalogo` (87), `parceiros_documentos_empresa` (8, **nenhuma** com arquivo), depósito `parceiros-instaladores-anexos` (**512** arquivos, privado, mas com política aberta — PC-6). **6** colaboradores não têm documento nenhum. **Conferido**, 01/11/2026.

### 11.2.8 Regras e armadilhas
- **O status nunca é reavaliado (achado, sem correção):** nada recalcula `VALIDO` → `VENCIDO` com o passar do tempo (não há cron nem recálculo na leitura). Em 01/11/2026 há **8** documentos `VALIDO` com vencimento já passado. Os cartões "Documentos vencidos" e o aviso "N doc(s) vencido(s)" da 11.1 leem essa coluna, então **subestimam**; a Central de Documentos (10.1) herda o mesmo. **Conferido.**
- **`homologado` é um campo morto (achado, sem correção):** as 31 empresas têm `homologado = false` e **nenhum código lê** a coluna; `certificacoes` (jsonb das 5 certificações antigas) está vazia em todas e a tela "não grava mais nele". **Conferido.**
- **Documentos da empresa sem tela:** o catálogo tem 22 tipos de escopo empresa (18 obrigatórios) e a tabela tem 8 linhas, mas **esta tela só registra documento de colaborador**; o documento de empresa só é lido (cláusula do assistente do Contrato). **Conferido.**
- **Comentário desatualizado:** o código fala em "79 tipos"; o catálogo tem **87**. **Conferido.**
- **Documento pessoal sem proteção real:** RG, CNH, ASO e carteira de vacinação ficam num depósito marcado privado, mas com política de leitura, escrita e exclusão para `public` (PC-6). **Conferido.**
- **A tela promete "compliance" e não bloqueia nada:** o Contrato só **avisa** (11.3); o bloqueio de verdade é o portão da obra (9). **Conferido.**

### 11.2.9 Testes
Nenhum teste de unidade; a rota entra no teste de fumaça (não rodei). **Cenários (sem teste):** *Dado* um documento com vencimento de ontem, *quando* o salvo, *então* fica `VENCIDO`. *Dado* o mesmo documento `VALIDO` salvo semana passada, *quando* o vencimento passa, *então* **continua** `VALIDO` (comportamento atual, 11.2.8).

### 11.2.10 Pendências e decisões
**Decisão do Gelson:** (a) recalcular o status na leitura ou por rotina diária (e avisar quem vence em 30 dias — o código antigo `validarCertificacoes` já pensava nisso); (b) aposentar `homologado`/`certificacoes` ou voltar a usá-los; (c) criar a tela de documentos da empresa; (d) quem pode editar (alçada).

### 11.2.11 Histórico
Nasceu com 5 certificações fixas em `parceiros_instaladores.certificacoes`; em 25/08 migrou para o catálogo por colaborador com vencimento real; a carteira de vacinação (26/08) e o aviso da Homologação no Contrato (01/09) vieram depois. **Herdado** (comentários do código).

---

## 11.3 Contrato Instalador

### 11.3.1 O que é
O contrato de **prestação de serviço de montagem** (instalação, remoção, ou remoção e adequação) entre a VerticalParts e a empresa montadora. É o documento que dá **valor, parcelas e prazo**; o montador assina por link e três pessoas da empresa assinam também. Todo o ciclo mora aqui: gerar, pedir aval, enviar, assinar, **revisar**, **anular**, **distratar** e baixar o PDF. **Conferido** em `contrato-instalador.jsx`, `contrato-instalador-store.js` (758 linhas), `contrato-instalador-engine.js` (841), `contrato-instalador-dossie.js` (192), `contrato-instalador-distrato-store.js`, nas migrations e nas funções do banco.

**Fora do escopo:** a página pública `/assinar/<token>` e a regra de assinatura digital (6, PC-3); o Contrato de **Venda** (6.1); a ART que nasce da primeira assinatura (9.6); o Diário que libera as parcelas (9.1); o pagamento em si (11.4).

### 11.3.2 Rota e arquivos
Rota `contrato-instalador`; URL `/juridico/contrato-instalador[/painel|novo[/<id>]]` (aba na URL, `useRouteTab`; o contrato aberto no painel, `useRotaItem`). Breadcrumb **Jurídico**. Arquivos: `contrato-instalador.jsx`, `-engine.js` (texto e cláusulas, puro), `-store.js` (`window.CIStore`), `-parcelas-store.js`, `-dossie.js` (traduz Dossiê + acordo em estado do assistente), `-preview.jsx`, `-distrato-store.js`; estilos em `styles/contrato-instalador.css`. O assinante usa `assinar.html`/`assinar-app.jsx`. **Conferido.**

### 11.3.3 Perfil e acesso
Alçada `contrato-instalador` (ver 15, criar 5, editar 5, excluir 3 pessoas). **No banco** conferem `editar`: `ci_salvar_edicao`, `anular_contrato_instalador`, a geração do distrato (as políticas do distrato exigem `ver`/`editar`). A **assinatura é pública**: o token é a credencial. **Conferido.**

### 11.3.4 O que a tela mostra
- **Painel** (aba padrão): cartões por situação (Rascunho, Enviado, Visualizado, Assinado; recusado e expirado ficam fora da conta), busca por número, empresa ou responsável, tabela com contrato, objeto, valor, situação e atividade; a cada 15 s recarrega. Por linha: 👁 auditoria, ⬇ baixar PDF, 🔗 abrir assinatura, **Enviar/Reenviar**.
- **Gaveta de auditoria:** linha do tempo da revisão atual, dados da assinatura (nome, hora, IP, dispositivo, hash), fila de assinaturas internas, parcelas, revisões anteriores, distrato, anulação.
- **Novo contrato:** assistente de **6 passos** com a pré-visualização do texto ao lado — 1 Início (modalidade e número do Dossiê), 2 Partes (contratada e responsável), 3 Objeto (equipamentos e serviços), 4 Logística, 5 Pagamento, 6 Revisão (anexos e assinatura).

### 11.3.5 Botões e controles
Do painel: **+ Novo contrato**, filtros, linha → gaveta. Da gaveta: **Editar** (cria revisão), **Anular assinatura**, **Gerar link novo** (após anular), **Gerar Distrato**, **Baixar contrato**, **Visualizar documento**, **Reenviar**. No assistente: **Voltar/Avançar**, **Gerar e enviar para assinatura →** (ou **Salvar alterações** na edição). **Conferido** (nomes pelo código).

### 11.3.6 Comportamento
1. **Gerar** (`createDraft`): reserva o número, monta o texto (`buildContract`), grava o contrato em `rascunho`, **cria as parcelas** (11.4) e **liga o preço combinado** ao contrato (`contratado`). Se as parcelas falharem, o contrato existe e a tela avisa em vermelho para chamar o Financeiro. Registra `CONTRATO_INSTALADOR_GERADO`.
2. **Número:** com Proposta, `VPNI-<Nº da cotação, 4 dígitos>`; avulso, `VPNI-<1º nº de série ou de projeto informado>`; um 2º montador na mesma base ganha `-2`, `-3`… (`reservarNumero`). **Herdado** do `CLAUDE.md` e **Conferido** no teste "Nº do contrato".
3. **Dossiê no Passo 1:** informar o Dossiê (ou vários, da mesma empresa) preenche modalidade, equipamento, obra, instalador, valor e parcelas a partir do **preço combinado** (`montarPatch`/`montarPatchVarios`); empresas diferentes bloqueiam; Dossiê sem acordo não preenche o valor e avisa. A distância continua manual.
4. **Enviar = pedir o aval** (`ci_pedir_envio`): grava o WhatsApp do montador (obrigatório, com DDD; sugerido do cadastro) e, **se o aval ainda não existe**, cria a decisão e pede à **Juliana** por WhatsApp (SIM/NÃO). **SIM** → os links saem sozinhos: a Contratada recebe o dela e Diego, Juliana e Maurício recebem os deles; **NÃO** → nada é enviado e o Maurício é avisado; dá para **reenviar o pedido**. Aval já aprovado → os avisos saem na hora. Contrato **sem** Nº de cotação também pede aval, chaveado pelo id do contrato.
5. **Assinaturas:** a Contratada assina por `/assinar/<token>` (link de **7 dias**; o painel marca `expirado` quando passa). As três internas assinam em `documento_signatarios` (tipo `contrato_instalador`) **em qualquer ordem**; `assinaturas_completas_em` marca quando todas existem. O status `assinado` do contrato significa "**a Contratada assinou**"; "completo" é outra coisa.
6. **Ao assinar** (a Contratada), o banco grava o aviso e a auditoria na mesma transação e coloca na fila `fluxo_pendentes` o evento `CONTRATO_INSTALADOR_ASSINADO`, que um usuário interno executa (motor de Gatilhos, **custo real** da cotação). O gatilho do banco também cria a **ART da obra** (9.6) na primeira assinatura e publica o aviso `instalador.contrato_assinado` (PC-7).
7. **Lembretes:** dias úteis às 09:00 de Brasília, cada assinatura pendente há 1+ dia recebe novo aviso; Cleiton, Maurício e Felipe recebem um resumo; com 3+ dias úteis sem assinar, o Gelson recebe um aviso de escalonamento. **Herdado** da migration `20261023140000`; o cron `ci-lembretes-assinatura` existe e está ativo (**Conferido**).
8. **Editar** (`salvarEdicao` → `ci_salvar_edicao`): **rascunho** edita no lugar, refaz as parcelas pendentes e solta o acordo (religa depois). **Já enviado ou assinado** → **nova revisão**: a anterior (documento, dados, assinatura, hash, fila) vai para `revisoes`, o contrato volta a `rascunho` com **link novo**, a fila e as parcelas pendentes saem, e **o aval já dado continua valendo** (decisão do Jurídico em 22/10); todos assinam de novo. Exige motivo (10 letras), checa conflito de edição (`atualizado_em`) e **recusa** se houver parcela paga ou recibo ativo.
9. **Anular assinatura:** função `anular_contrato_instalador`; o contrato vira `expirado`, a assinatura antiga fica em `audit.anulacao`, o preço combinado volta a `combinado` e as parcelas **pendentes** saem; recusa se houver parcela paga ou recibo. **Gerar link novo** (`reabrirAnulado`) devolve o contrato a rascunho com token novo, recria as parcelas e religa o acordo. **Nunca edite o contrato direto no banco.**
10. **Distrato** (contrato `assinado`): motivo obrigatório (10 letras) e, opcionalmente, **transferir o valor já recebido** a outro contrato; assina a Contratada (token próprio) e depois a fila interna (ciência). Quando todos assinam, o contrato vira `distratado`, as parcelas pendentes são canceladas (as pagas ficam) e o acordo volta a `combinado`. Recusa de qualquer assinante fecha o distrato como `recusado`. **Herdado** do `CLAUDE.md` (30/10); **Conferido**: tabela `contratos_instalador_distratos` e funções `gerar_distrato_instalador`, `public_di_*`.
11. **Baixar contrato** (⬇): PDF gerado no navegador (html2canvas + jsPDF, paginado por bloco, com o bloco de assinaturas quando houver). Não usa o motor react-pdf do Contrato de Venda. **Herdado.**
12. **Excluir:** só **rascunho**; a exclusão leva as parcelas junto (chave com cascata). **Conferido** (`remove`).

### 11.3.7 Dados
`contratos_instalador` (**6**, todos `assinado`; nenhum rascunho, enviado ou expirado hoje), `contrato_instalador_parcelas` (**23**), `contratos_instalador_distratos` (**0**), `documento_signatarios` (tipo `contrato_instalador`), `instalador_acordos` (7), `decisoes_gerenciais` (`contratacao_mao_obra_ceo`: 3 aprovadas, 1 cancelada), `eventos_outbox`. RPCs públicas `public_ci_obter/visualizado/assinar/recusar/fila` e `public_di_*` (`SECURITY DEFINER`); helpers `_ci_*`/`_di_*` sem permissão pública. **Conferido** (`pg_proc`, contagens).

### 11.3.8 Regras e armadilhas
- **Tabela do contrato aberta à chave pública (achado, sem correção):** `contratos_instalador` tem política `ALL` para `anon` (leitura e escrita de contrato, valores, CNPJ e CPF do responsável e `form_state`, que pode ter dados bancários). A página pública usa RPC, mas o **caminho de queda** do front (se a RPC falhar, ou com `vp_public_rpc='off'`) lê e grava a tabela direto — fechar a tabela exige antes retirar esse caminho. A tabela de distratos, ao contrário, nasceu **fechada** (só `authenticated`, com `ver`/`editar`). **Conferido** (políticas); queda **Herdada** (`CLAUDE.md`, 05/10).
- **O aval ainda tem o nome antigo:** tipo `contratacao_mao_obra_ceo`, mas quem responde é a **Juliana** (papel `aval_instalador`, desde 22/10; textos ajustados em 31/10). Quem ler a Central de Decisões por tipo se confunde. **Conferido.**
- **Telefone pessoal em arquivo versionado (achado, sem correção):** a migration `20261022190000_aval_instalador_juliana.sql` e `docs/eventos/vphub-instalador.md` trazem telefones de pessoas no texto; o repositório é público (Art. 28). **Não repeti os números aqui.** **Conferido.**
- **Aviso de homologação não bloqueia:** CNPJ não cadastrado ou documentação incompleta só mostram aviso amarelo no Passo 2 (11.2). **Conferido.**
- **Parcelas só nascem liberadas em dois casos:** sem Dossiê vinculado (contrato avulso) só a **1ª** por marco e as personalizadas; as demais ficam "aguardando" e **não há botão de liberação manual** (lacuna conhecida). **Conferido** (`criarParcelas`).
- **Contratos já assinados não mudam de texto:** `/assinar` mostra o `doc` gravado; só contrato novo traz cláusula nova (cláusulas do advogado de 27/10, logística 6.1–6.6; a multa moratória antiga 9.2 / 0,5% foi substituída em 02/11/2026, ver 11.3.11). Numeração das cláusulas acompanha a posição real (`renumClauseItems`). **Herdado** + teste de numeração **Conferido**.
- **Validação na borda:** CNPJ e CPF com dígito verificador (rejeita repetido), CNPJ da própria VerticalParts bloqueado como Contratada, endereço completo e dados civis do responsável obrigatórios; a soma das parcelas personalizadas precisa fechar o total. **Conferido** (`ciValidateStep`).
- **`vp_public_rpc`, expiração e hash** seguem o desenho de 6 (PC-3): o hash cobre documento, dados, nome e instante. **Herdado.**
- **Duas coisas chamadas "assinado":** contrato `assinado` ≠ assinaturas completas (item 5). Painel e Pagamentos filtram por `assinado`. **Conferido.**

### 11.3.9 Testes
`contrato-instalador-engine.test.js` (21: dividir em parcelas, cláusula 5.1, concordância, numeração, equipamentos e 1.1.1, prazo, cláusulas novas, e — desde 02/11/2026 — 2.14/2.15, 5.3 a 5.9, rescisão e penalidades, referências cruzadas com e sem logística, diferença instalação × remoção), `contrato-instalador-dossie.test.js` (11: Dossiê + acordo, vários Dossiês, local do serviço), `contrato-instalador-store.test.js` (1: reserva de número); a rota entra no teste de fumaça (não rodei). **Sem teste:** aval, fila de assinaturas, revisão, anulação, distrato (conferidos só no banco e em transações desfeitas, **Herdado**). **Cenários:** *Dado* um Dossiê com preço combinado, *quando* informo o número no Passo 1, *então* valor e parcelas vêm do acordo. *Dado* um contrato enviado, *quando* edito, *então* nasce a revisão 2 em rascunho e a 1 fica guardada com a assinatura.

### 11.3.10 Pendências e decisões
**Decisão do Gelson:** (a) renomear o tipo da decisão (`contratacao_mao_obra_ceo`) ou só documentar; (b) retirar o caminho de queda para poder fechar `contratos_instalador`; (c) tirar telefone de arquivo versionado; (d) liberação manual de parcela de contrato avulso; (e) contato do montador (validar e-mail/WhatsApp no envio — "não corrigido de propósito" desde 29/09). Sem "?" próprio nem tutorial (PC-10).

### 11.3.11 Histórico
**Redação nova do advogado (02/11/2026):** o motor passou a gerar 2.14/2.15, 4.3 a 4.4, 5.3 a 5.9, a rescisão (13 itens) e as penalidades (multa compensatória de 20% do valor global, moratória de 0,2% por dia útil limitada a 10%, indenização suplementar, IPCA); a numeração e as referências cruzadas (`[[item:id:n]]` e `__ID__`) acompanham a posição real da cláusula. Em remoção e remoção/adequação mudam "montagem" → "desmontagem, remoção ou adequação", "aproveitáveis" → "comprovados", a segurança "da instalação" → "da obra, do equipamento e das pessoas" e o equipamento desmontado entra na devolução (8.6). **Conferido** em teste (`contrato-instalador-engine.test.js`) e abrindo o assistente no navegador. Contrato já assinado não muda (usa o `doc` gravado). Auditoria e correções (29/09), número nascido dos equipamentos (29/09), pedido de aval (CEO → Juliana, 20–22/10), assinaturas internas em sequência e depois em qualquer ordem (16–21/10), revisões (22/10), cláusulas do advogado (27/10), baixar PDF e distrato (30/10). **Herdado** (`CLAUDE.md` e migrations); o detalhe permanece lá até o Gelson aprovar este documento (PC-11).

---

## 11.4 Pagamentos a Instaladores

### 11.4.1 O que é
A tela do **Financeiro** para o dinheiro do montador, com três abas: **Parcelas** (o que o Contrato manda pagar e quando está liberado), **Preços combinados** (o valor fechado por equipamento) e **Recibos** (o montador assina que recebeu). **O sistema não movimenta dinheiro**: só sinaliza, pede aprovação e registra. **Conferido** em `pagamentos-instalador.jsx` (193), `-acordos.jsx` (213), `-recibos.jsx` (186), `contrato-instalador-parcelas-store.js`, `instalador-acordos-store.js`, `instalador-recibos-store.js`, `recibo-instalador-app.jsx`.

**Fora do escopo:** o Contrato que gera as parcelas (11.3); o evento de obra que as libera (9.1); o pagamento no Omie (feito fora); a aprovação em si (Central de Decisões, 1.3).

### 11.4.2 Rota e arquivos
Rota `pagamentos-instalador`; URL `/adm-financeiro/pagamentos-instalador[/parcelas|acordos|recibos]`. Página pública do recibo: `/recibo/<token>` (`recibo-instalador.html`, `recibo-instalador-app.jsx`, na lista de páginas públicas do teste de fumaça). **Conferido.**

### 11.4.3 Perfil e acesso
O item de menu e a rota são restritos aos perfis **financeiro, engenharia e admin** (`restrict` em `shell.jsx` e em `app.jsx`). Dentro, "Preços combinados" e "Recibos" mostram os botões de criar e cancelar só a quem tem **`contrato-instalador.editar`** (Administrador passa). O módulo `pagamentos-instalador` **não existe** em `alcadas_capacidade` (0 linhas). A página do recibo não pede login: o token é a credencial. **Conferido.**

### 11.4.4 O que a tela mostra
- **Parcelas:** três cartões (**A pagar agora**, **Aguardando marco**, **Pago**; clicáveis como filtro), botões de filtro e a tabela (instalador, contrato com link, parcela, valor — com "− abatido (recibo) → a pagar" —, situação, pago em/por). Só entram parcelas de contrato **assinado**.
- **Preços combinados:** três cartões (equipamentos com preço, total combinado, economia sobre a tabela) e a tabela por Dossiê (instalador, tabela, combinado, parcelas, situação `Combinado`/`Contratado`).
- **Recibos:** três cartões (aguardando assinatura, confirmados, adiantamentos a abater) e a tabela de recibos.
- **Página do recibo:** uma folha de cheque com o valor, o extenso, o pagador e o campo para o montador digitar o nome e assinar ou recusar.

### 11.4.5 Botões e controles
**Marcar paga** / **Solicitar aprovação** / **Reabrir** (parcela); **+ Novo preço combinado**, **Editar**, **Cancelar** (só enquanto `combinado`); **+ Novo recibo**, **Copiar link**, **WhatsApp**, **Cancelar** (só `pendente`), **Ver recibo**. **Conferido.**

### 11.4.6 Comportamento
1. **Liberar:** a parcela com gatilho (`INSTALACAO_INICIADA`, `INSTALACAO_METADE_EXECUCAO`, `INSTALACAO_CONCLUIDA`) fica `liberada` quando **todos** os Dossiês do contrato bateram o evento (`eventos_fluxo`); a chamada sai de `EventosFluxo.registrar`. Parcela personalizada nasce liberada.
2. **Pagar** (`marcarPaga`): pede a decisão `pagamento_instalador_parcela` ao **Gestor Comercial** (Regiane ou Guilherme) na Central de Decisões; o botão vira "Solicitar aprovação" enquanto pendente e fica desabilitado se reprovada. Só depois grava `paga`, `pago_em`, `pago_por`. **Reabrir** volta a `pendente` com `confirm`.
3. **Preço combinado:** 1 acordo ativo por equipamento; escolhe o Dossiê, a empresa, valor combinado, valor de tabela (opcional) e parcelas (1 a 12); acordo `contratado` **não muda mais**; cancelar só enquanto `combinado`. O Contrato herda o valor.
4. **Recibo:** o Financeiro registra o pagamento já feito (tipo `adiantamento` ou `parcela`, valor, data, forma), o sistema gera o link e o montador assina. **Adiantamento assinado abate** as parcelas **pendentes** do contrato, da primeira à última (em centavos, sem tocar em parcela paga); o resto vira "excedente". O envio é pelo botão **WhatsApp** (abre `wa.me` com o texto pronto) ou copiando o link — **não** sai sozinho.
5. **Assinar o recibo** (RPC `public_recibo_assinar`): exige o nome, registra IP, dispositivo e hash, e grava um aviso para o Financeiro na Central de Notificações; existe um gatilho do banco (`trg_evt_recibo_assinado`) para o aviso `instalador.recibo_assinado` — o conteúdo do gatilho **não** reli. **Conferido** (a função de assinatura); gatilho **Não verificado**.

### 11.4.7 Dados
`contrato_instalador_parcelas` (23: **todas** `pendente` e `liberada`; **nenhuma paga**), `instalador_acordos` (7: 5 contratados, 1 combinado, 1 cancelado), `instalador_recibos` (**0**), `decisoes_gerenciais` (`pagamento_instalador_parcela`: **2 reprovadas**), `eventos_fluxo`. **Conferido**, 01/11/2026.

### 11.4.8 Regras e armadilhas
- **A trava do Gestor Comercial é só da tela (achado, sem correção):** `contrato_instalador_parcelas` tem política aberta a `anon` para inclusão, leitura e **alteração**; quem tem a chave pública marca parcela paga sem passar pela aprovação. E, no código, o portão só roda `if (window.DecisoesStore)`: sem o store carregado, **passa** (falha aberta). **Conferido.** O Art. 25 já avisa.
- **Reabrir sem alçada nem aprovação:** qualquer pessoa com acesso à tela reabre parcela paga (só um `confirm`), e a decisão já aprovada continua `aprovada`. **Conferido.**
- **Recibo assinado não baixa a parcela:** o recibo do tipo "parcela" e o `parcela_id` existem, mas a assinatura **não** marca a parcela como paga; só o adiantamento tem efeito (visual, o abatimento). Não há recibo gerado ainda. **Conferido.**
- **`marcarEnviado` engole o erro** do recibo; o link vai por WhatsApp manual. **Conferido.**
- **Lacuna de liberação manual** em contrato avulso (11.3.8) deixa parcelas "aguardando" para sempre. **Conferido.**
- **As 23 parcelas liberadas estão sem pagar:** duas decisões foram reprovadas e nenhuma foi aprovada; o painel mostra tudo em "A pagar agora". Não é defeito do código — é o retrato do uso. **Conferido.**
- **O "pago" que importa é o do Omie, e vem de outro caminho** (11.1 e PC-4): a parcela do Contrato e o título do Omie não são cruzados.

### 11.4.9 Testes
`instalador-acordos-store.test.js` (2: moeda e validação), `instalador-recibos-store.test.js` (3: abatimento só de adiantamento assinado, excedente, validação). **Sem teste:** liberar parcela, portão de pagamento, recibo público. **Cenários:** *Dado* um adiantamento assinado de R$ 5.000 e duas parcelas pendentes, *quando* a tela calcula, *então* abate da primeira até zerar e segue na segunda. *Dado* uma parcela liberada sem decisão, *quando* clico em Marcar paga, *então* cria a solicitação ao Gestor Comercial e **não** paga.

### 11.4.10 Pendências e decisões
**Decisão do Gelson:** (a) a assinatura do recibo de parcela deve marcar a parcela paga? (b) reabrir parcela deve pedir alçada e invalidar a decisão; (c) o portão deve falhar **fechado**; (d) cruzar parcela do Contrato com título do Omie; (e) fechar as tabelas à chave pública (#571, PC-6).

### 11.4.11 Histórico
Trilha B (01/09): parcelas ligadas ao progresso; trava do Gestor Comercial (11–12/09); preço combinado e recibos (15/10); transferência de valor no distrato (30/10). **Herdado.**

---

## 11.5 Cronograma de Pagamento da Instalação

### 11.5.1 O que é
Um controle **manual e independente** de pagamento da mão de obra em **4 fases** por equipamento: 1ª Início da instalação, 2ª Equipamento tracionado, 3ª Portas de pavimento + elétrica prontos, 4ª Conclusão. O Financeiro "libera" e "registra o pagamento" à mão. **Conferido** em `entrega.jsx` (`CronogramaPage`, `ModalNovoCronograma`, `ModalExcluirCronograma`).

**Fora do escopo:** as parcelas do Contrato (11.4), que é o caminho com aprovação; o Data Book (10.2), que mora no mesmo arquivo.

### 11.5.2 Rota e arquivos
Rota `cronograma`; URL `/engenharia/cronograma` (o menu foi movido para este grupo em 29/10 **sem mudar a URL**). O título da página na barra diz "Cronograma de Instalação"; o menu diz "Cronograma de Pagamento da Instalação". **Conferido.**

### 11.5.3 Perfil e acesso
Alçada `cronograma` existe (ver 8, criar 7, editar 7, excluir 2), mas a tela **não a lê**. **Conferido.**

### 11.5.4 O que a tela mostra
Quatro cartões (Equipamentos, Total contratado, Já pago, A liberar), tabela (endereço, montador, paradas, carga, valor total, progresso "N/4 fases · %") e, ao escolher uma linha, as 4 fases com valor, situação (`Pendente`, `Liberada`, `Paga`) e o botão da vez.

### 11.5.5 Botões e controles
**Novo cronograma** (endereço, montador em texto livre, paradas, carga, valor e os 4 valores, que **precisam somar** o total); **Liberar (marco atingido)** e **Registrar pagamento** por fase; 🗑 excluir (exige **motivo de 10 letras**, gravado em `vp_logs`). **Conferido.**

### 11.5.6 Comportamento
A fase 1 nasce `Liberada` e as outras `Pendente`; cada clique avança um estágio (`Pendente → Liberada → Paga`) com um `update` direto, **sem aprovação, sem alçada e sem conferir o marco físico**. A exclusão é **física**.

### 11.5.7 Dados
`instalacao_cronograma`: **0 linhas** em 01/11/2026 (colunas: id `IC-xxxxxx`, endereço, montador, paradas, carga, valor total, 4 valores e 4 situações). Não tem chave para Contrato, Dossiê, empresa ou Omie. **Conferido.**

### 11.5.8 Regras e armadilhas
- **Tabela aberta, inclusive para apagar (achado, sem correção):** quatro políticas (`public`: ler, inserir, alterar, **apagar**). **Conferido.**
- **É um segundo caminho de pagamento, sem as travas do primeiro:** pagar aqui não passa pelo Gestor Comercial; o montador é texto, não a empresa cadastrada; nada impede lançar a mesma obra aqui e no Contrato. **Conferido.**
- **Nunca foi usado em produção** (0 linhas) e nada o alimenta; o motor de Gatilhos ainda comenta o "Cronograma de Instalação (checklist por dossiê)" como origem do evento de metade da execução, que hoje vem do **Diário** (9.1). **Conferido.**
- **`advance` não confere o retorno** (sem `select`) e `reload` pode mostrar estado velho. **Conferido.**

### 11.5.9 Testes
Nenhum; a rota entra no teste de fumaça (não rodei). **Cenário (sem teste):** *Dado* um cronograma com a 1ª fase liberada, *quando* clico em Registrar pagamento, *então* a fase vira `Paga` (sem aprovação).

### 11.5.10 Pendências e decisões
**Decisão do Gelson:** aposentar o Cronograma (o Contrato + Pagamentos cobrem o caso), ou ligá-lo ao Contrato e à aprovação. Se ficar, ler a alçada e trocar a exclusão física.

### 11.5.11 Histórico
Nasceu como cronograma manual em 4 fases; ganhou o motivo de exclusão e o log; foi reposicionado no menu para Parceiros & Instaladores (29/10). **Herdado.**

---

## Parte comum de Parceiros & Instaladores

### PC-1 Mapa de ligações
- **Entra:** Dossiê da Obra (9.1) → vínculo empresa↔obra (principal, roster e por equipamento) e a decisão **"montador entra na obra"** (Supervisor de Obra; 20 aprovadas, 5 pendentes, 1 reprovada); Proposta (4.5) → ativos e Nº da cotação do número do contrato; Atualização de Custos (5.1) → valor de **tabela** do acordo; Diário de Obra (9.1) → eventos que liberam parcelas; Omie → títulos a pagar; Central de Decisões (1.3) → Juliana e Gestor Comercial; vpsistema → telefones e a Central de Eventos.
- **Sai:** documentos do montador → Central de Documentos (10.1) e portão "obra pronta" (9); primeira assinatura → **ART** (9.6) e custo real da cotação (5); eventos do contrato → motor de Gatilhos (1.4: nós `CI_GERADO` e `CI_ASSINADO`, que alimenta `IMS_CONTRATADO`); avisos → WhatsApp (gi-avisos) e Notificações (1.2).

### PC-2 O montador de ponta a ponta
Cadastrar a empresa e os colaboradores (11.1) → anexar os documentos com validade (11.2) → vincular ao Dossiê e passar pela decisão "entra na obra" (9.1) → fechar o **preço combinado** por equipamento (11.4) → gerar o **Contrato** (11.3), que cria as parcelas → **aval da Juliana** → assinaturas (montador + Diego, Juliana, Maurício) → ART (9.6) → obra no Diário libera as parcelas → **Gestor Comercial** aprova cada pagamento → o Financeiro paga fora (Omie) e registra o **recibo**, que o montador assina → o cartão da empresa mostra o que o Omie pagou.

### PC-3 Rotas, páginas públicas e arquivos
- **Cinco rotas com item de menu**, com prefixos de **grupos antigos**: `cadastro-instaladores` (`/cadastros/…`), `rh-homologacao` (`/rh/…`), `contrato-instalador` (`/juridico/…`), `pagamentos-instalador` (`/adm-financeiro/…`) e `cronograma` (`/engenharia/…`). **Conferido** (`docs/MAPA_DE_ROTAS.md`).
- **Públicas:** `/recibo/<token>` (11.4) e `/assinar/<token>` (6, PC-3), ambas na lista de páginas públicas do teste de fumaça.
- **Arquivo misto:** `entrega.jsx` guarda `CronogramaPage` (11.5) e `DataBookPage` (10.2).

### PC-4 Os "valores" do montador (e por que não se confundem)
| Valor | Onde mora | Quem manda | Para que serve |
|---|---|---|---|
| **Valor de tabela** | Atualização de Custos (5.1) e `instalador_acordos.valor_tabela` | Financeiro | referência e economia |
| **Preço combinado** | `instalador_acordos` | Engenharia | o Contrato herda |
| **Valor do contrato** | `contratos_instalador.valor_total` | Jurídico | o que o contrato diz |
| **Parcelas** | `contrato_instalador_parcelas` | Contrato + obra | o que pode ser pago |
| **Recibo** | `instalador_recibos` | Financeiro + montador | prova de recebimento; abate adiantamento |
| **Título do Omie** | `omie_pagamentos_cache` | Omie | o "pago" mostrado no cadastro |
| **Cronograma** | `instalacao_cronograma` | manual | legado, vazio |

Os seis primeiros **não são cruzados** por código. Um contrato de R$ X pode ter parcelas que somam X, recibos que somam Y e títulos do Omie que somam Z, sem alerta de divergência. **Conferido.** (A tela da empresa só compara o pago do Omie com o progresso da obra.)

### PC-5 Quem aprova o quê
| Ato | Quem decide | Onde | Como |
|---|---|---|---|
| Enviar o Contrato ao montador | **Juliana** | WhatsApp (resposta SIM/NÃO) | decisão `contratacao_mao_obra_ceo`, papel `aval_instalador` |
| Contratada entra na obra | **Supervisor de Obra** (Maurício) | Central de Decisões | decisão `montador_entra_obra_rh` |
| Pagar uma parcela | **Gestor Comercial** (Regiane ou Guilherme) | Central de Decisões | decisão `pagamento_instalador_parcela` |
| Assinar o Contrato | Contratada + Diego, Juliana, Maurício | link por pessoa | `documento_signatarios` |
| Editar, anular, distratar | quem tem `contrato-instalador.editar` | Contrato | função no banco confere |
| Marcar fase do Cronograma | **ninguém** (sem aprovação) | Cronograma | 11.5.8 |

**Conferido** em `decisoes-store.js` (lido em 01/11/2026) e nas decisões gravadas em `decisoes_gerenciais`.

### PC-6 Identidade, alçadas e segurança
O app fala com o banco pela chave pública e o e-mail do usuário vem do navegador (Art. 25); trava de tela é organização, não segurança. **Estado real destas tabelas (Conferido, `pg_policies`, 01/11/2026):**

| Tabela | Dado sensível | Quem acessa |
|---|---|---|
| `parceiros_instaladores` | CNPJ, **banco/agência/conta/PIX** | `public`: ler, inserir, alterar, **apagar** |
| `parceiros_colaboradores` | **CPF, RG, CNH**, endereço | `anon` e `authenticated`: tudo |
| `parceiros_documentos_colaborador` | vencimentos, caminho do arquivo | `anon` e `authenticated`: tudo |
| `parceiros_documentos_empresa` / `parceiros_doc_catalogo` | vencimentos, caminho do arquivo | `anon`: ler, inserir, alterar |
| depósito `parceiros-instaladores-anexos` | **RG, CNH, ASO, vacina** (512 arquivos) | privado, mas política `public` para ler, gravar, atualizar, apagar |
| `contratos_instalador` | contrato, valores, CPF/CNPJ | `anon` e `authenticated`: tudo |
| `contrato_instalador_parcelas` | o que pagar | `anon`: inserir, ler, alterar |
| `dossier_obra_instaladores` | vínculo empresa↔obra | `public`: ler, inserir, apagar |
| `instalacao_cronograma` | pagamento manual | `public`: ler, inserir, alterar, apagar |
| `omie_pagamentos_cache` / `_sync_log` | valores pagos | `public`: ler |
| `instalador_acordos`, `instalador_recibos`, `contratos_instalador_distratos` | preço, recibo, distrato | **fechadas** (`authenticated` + usuário ativo; distrato exige `ver`/`editar`) |
| `omie_pagamentos_vinculo_manual` | vínculo título↔obra | **fechada**, sem política (só servidor) |

O isolamento verdadeiro é a #571 (plano em `docs/superpowers/plans/2026-10-02-autenticacao-e-rls-571.md`); ao fechar, cuidar do **caminho de queda** das RPCs do contrato (11.3.8) e do depósito (o app abre o arquivo por link assinado gerado no navegador). **Achado, sem correção.**

### PC-7 Gatilhos, eventos, crons e funções
- **Eventos do motor (1.4):** `CONTRATO_INSTALADOR_GERADO` (no `createDraft`), `CONTRATO_INSTALADOR_ASSINADO` (pela fila `fluxo_pendentes`, tipo `contrato_instalador_assinado`), e os de obra que **liberam parcelas**: `INSTALACAO_INICIADA`, `INSTALACAO_METADE_EXECUCAO`, `INSTALACAO_CONCLUIDA`. **Conferido.**
- **Gatilhos no banco:** `trg_evt_aval_instalador`, `trg_evt_contrato_instalador_assinado`, `trg_evt_recibo_assinado` (publicam avisos em `eventos_outbox`); o gatilho que cria a ART (9.6). Em `eventos_outbox`: `instalador.aval_pendente` 1 enviado, `instalador.contrato_assinado` 6 enviados e **1 falha** (15/10), `instalador.recibo_assinado` **0**. **Conferido.**
- **Crons (Conferido):** `omie-sync-pagamentos-instaladores-diario` (`0 9 * * *` UTC = 06:00 BRT), `ci-lembretes-assinatura` (`0 12 * * 1-5` UTC = 09:00 BRT), `eventos-publicar-outbox` (a cada minuto).
- **Funções do banco (Conferido):** `ci_pedir_envio`, `ci_salvar_edicao`, `anular_contrato_instalador`, `gerar_distrato_instalador`, `decisao_aval_reenviar`, `decisao_whatsapp_responder`, e as públicas `public_ci_*`, `public_di_*`, `public_recibo_*`.
- **Edge Functions:** `omie_sync_pagamentos_instaladores` (v30, `verify_jwt: true`, só **lê** o Omie) — o comentário no código ainda diz `verify_jwt:false`, **desatualizado em relação à produção**; `eventos-publicar` (`verify_jwt: true`); `decisao-resposta-whatsapp` (`verify_jwt: false`, recebe a resposta da Juliana). O log de sincronização tem 189 execuções, **39 com erro** (histórico desde 04/09); a de 01/11 leu 31 empresas e gravou 731 títulos (a tabela tem 740 linhas — a diferença **não verificada**). **Conferido.**
- **Eventos dependem de um usuário interno com o sistema aberto** (a fila `fluxo_pendentes`, 1.4): a liberação de parcela e o custo real saem quando alguém interno processa a fila. **Herdado.**

### PC-8 Tabelas
`parceiros_instaladores` (31), `parceiros_colaboradores` (63), `parceiros_documentos_colaborador` (520), `parceiros_documentos_empresa` (8), `parceiros_doc_catalogo` (87), `dossier_obra_instaladores` (2), `contratos_instalador` (6), `contrato_instalador_parcelas` (23), `contratos_instalador_distratos` (0), `instalador_acordos` (7), `instalador_recibos` (0), `omie_pagamentos_cache` (740), `omie_pagamentos_sync_log` (189), `omie_pagamentos_vinculo_manual` (21), `instalacao_cronograma` (0), mais `documento_signatarios` (tipo `contrato_instalador`), `decisoes_gerenciais` e `eventos_outbox`. **Chaves estrangeiras (Conferido):** `parceiros_colaboradores`, os documentos, `dossier_obra`, `dossier_obra_instaladores` e `equipamentos_obra` apontam para a empresa **sem cascata** (impedem apagar); `omie_pagamentos_cache` aponta com `set null`; **acordos, recibos e contratos não têm chave** para empresa nem Dossiê (o contrato só aponta para `perfis` e `propostas`; os demais guardam texto e ids soltos); parcelas e Dossiê-roster têm cascata a partir do contrato e do Dossiê.

### PC-9 Navegação, cache e testes
Empresa aberta (11.1, 11.2), aba e contrato aberto (11.3), aba (11.4) vivem na URL. **Testes de unidade do módulo:** 33 (engine 16, Dossiê 11, acordos 2, recibos 3, contrato-store 1); **sem teste** de homologação, parcelas, páginas, recibo público, cronograma. A suíte inteira e o e2e **não foram rodados nesta sessão** (documentação); o CI do PR roda os dois checks obrigatórios.

### PC-10 Menu "?" e tutoriais
Só a **Homologação** tem linha no "?" (`HELP_TOPICS`); o Contrato aparece no tópico genérico "juridico". **Nenhuma** das cinco telas tem tutorial (não há pasta de Parceiros & Instaladores em `TreinamentoVP/`). O Copiloto tem texto embutido para `cadastro-instaladores`, `contrato-instalador` e `rh-homologacao` e **não** tem para `pagamentos-instalador` nem `cronograma`; a tabela `vp_copiloto_docs` não tem linha de nenhuma. **Conferido.** Tutorial não se edita à mão: pedir à sessão de tutoriais.

### PC-11 Documentos soltos e destino do que foi concatenado
| Origem | Assunto | Destino |
|---|---|---|
| `CLAUDE.md` — "Contrato Instalador — auditoria + correções, inclusive avulso (29/09)" | validações, parcelas, assinatura, painel | **Concatenado** em 11.3 (itens 1–9, 11.3.8); a seção fica com a nota "→ parte já migrada" |
| `CLAUDE.md` — "Contrato Instalador — Nº do contrato nasce dos equipamentos (29/09)" | `VPNI-…` | **Concatenado** em 11.3.6 item 2 |
| `CLAUDE.md` — "Contrato do Instalador — cláusulas do advogado e numeração (27/10)" | cláusulas, numeração | **Concatenado** em 11.3.8 (resumo); o texto das cláusulas fica no motor |
| `CLAUDE.md` — "Contrato do Instalador — botão Baixar contrato (30/10)" | PDF | **Concatenado** em 11.3.6 item 11 |
| `CLAUDE.md` — "Contrato do Instalador — Distrato bilateral (30/10)" | distrato e 3 achados de segurança | **Concatenado** em 11.3.6 item 10 (o detalhe técnico dos achados fica no Git/na seção) |
| `CLAUDE.md` — "Contrato Instalador — anular assinatura (15/10)" | anulação | **Concatenado** em 11.3.6 item 9 |
| `CLAUDE.md` — "Cronograma de Pagamento da Instalação — reposicionado no menu (29/10)" | menu | **Concatenado** em 11.5 |
| `docs/eventos/vphub-instalador.md` | como ligar os 3 avisos de WhatsApp na Central de Eventos | **Apontado** a PC-7; o arquivo **fica** (traz telefones — achado 11.3.8) e é referência do mapa `2026-10-31-mapa-de-destino-docs-soltos.md`, que o destinava a este módulo |
| `docs/MAPA_DE_ROTAS.md` | gerado | Fonte das URLs |
| `docs/seguranca/matriz-acesso-rls.md` | matriz de RLS | Do módulo 15; PC-6 traz o estado destas tabelas |

Nenhum arquivo foi apagado.

### PC-12 Benefícios trocados com os outros módulos

- **Recebido de Quadros de Comando (04/11/2026, texto em `14_quadros_comando.md` PC-12, Art. 49):** (a) o Omie repete a linha do item com **quantidade 0** — somar por código e ignorar o zero antes de contar linhas ou unidades; (b) **metro e peça nunca se somam** — total por unidade de medida; (c) a caixa de uma tabela longa deve ter a **altura da janela**, para a barra de rolagem lateral ficar à vista; (d) função de banco nova se testa **numa transação que se desfaz**, incluindo um usuário ativo **sem** a alçada (a recusa por "sem sessão" não prova a trava de alçada); (e) a **observação do item** do pedido do Omie (`pcp_pedido_itens.obs_item`) guarda o que a proposta mostra dentro do item. **Conferido** (04/11/2026).
- **Recebido:** o selo de verificação e "achado, sem correção" (de todos); a conferência de **política aberta** e de **alçada declarada e nunca lida** (de 8, 9 e 10: aqui as cinco telas); **falha do portão fecha** (de 5: `podeIniciarCompra` bloqueia se não consegue ler; o portão de pagamento daqui falha aberta, 11.4.8); a **fila `fluxo_pendentes`** para efeitos de página pública (de 1 e 6); o **teste de paridade** (de 9).
- **Doado** (texto completo aqui; os outros apontam): (1) **status gravado em coluna a partir de uma data precisa de recálculo** — `VALIDO` gravado no salvamento nunca vira `VENCIDO` (8 casos hoje; a Central de Documentos, 10.1, lê esse status); vale para qualquer "vencido" derivado de data; (2) **portão que falha aberta** (`if (window.DecisoesStore)`) — um portão de aprovação deve falhar fechado; (3) **telefone ou dado pessoal em migration e em documento versionado** (Art. 28); (4) **cadastro de terceiros com exclusão física** — o Art. 16 não cobre empresa instaladora, colaborador, contrato, acordo e recibo; (5) **dois caminhos de pagamento para a mesma coisa** (Contrato + Cronograma) sem a mesma trava; (6) **comentário de código que contradiz a produção** (`verify_jwt` da função de pagamentos); (7) **padrão a conferir nos outros módulos:** "documento enviado nunca é sobrescrito; editar cria revisão e guarda assinatura e hash" (`ci_salvar_edicao`) — **Não verificado** se Proposta e Contrato de Venda têm o mesmo. Registrado nos documentos 1 a 10.
- **Recebido de Logística Interna (01/11/2026, texto em `12_logistica_interna.md` PC-12):** o link do **Painel TV** da Separação é uma credencial: quem o tem vê a fila; é gerado, listado e **revogável** (12.3.8) — o mesmo cuidado vale para o link do recibo (11.4). **Conferido** no código, 01/11/2026.
- **Recebido de Fabricação (01/11/2026, texto em `13_fabricacao.md` PC-12):** o desenho **RPC por token com tabelas fechadas** de Corrimão/Corte (13.9) é o modelo a seguir para links públicos (recibo, assinatura); o da Evolução do Quadro (13.8) é o contra-exemplo. **Conferido** no banco, 01/11/2026.
- **Recebido de Administração (01/11/2026, texto em `15_administracao.md` PC-12):** o bucket `parceiros-instaladores-anexos` é privado (URL assinada), correto para documento pessoal; `colaboradores_vpsistema` e `perfis` (e-mail e nível) são legíveis pela chave pública. **Conferido.**
- **Recebido de Serviços (01/11/2026, texto em `16_servicos.md` PC-2):** todo alerta com destinatário também vira WhatsApp pelo gi-avisos; para chegar certo, título curto com o essencial na frente, sem "teste", sem R$ no título e com o dia da semana por extenso, a obra ou o código do contrato quando houver vários no mesmo dia (o agrupamento de 24 h apaga números). **Conferido** no código do gi-avisos.
