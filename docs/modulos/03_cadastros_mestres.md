# 3 Cadastros Mestres — documento do módulo (REAL, fonte da verdade — 31/10/2026)

> **Status: REAL (documento oficial do módulo 3), aprovado pelo Gelson em 31/10/2026.** Este documento substitui a "especificação técnica" anterior do módulo (seções 1 a 17, de 31/10/2026, que continua no histórico do Git) e traz tudo o que o `CLAUDE.md` guardava sobre Clientes e Fornecedores, exceto a **lei** (a Área Blindada "Cadastro com transação nunca é excluído" continua lá, porque é lei). Histórico de entrega não se repete aqui: o Git guarda.
>
> **Fonte da verdade:** o código e o banco, conferidos em 31/10/2026 (primeira conferência contra `bfcf9dd`; **reconferida de ponta a ponta contra `origin/main` `980586c`**: telas, as duas stores, `enderecos-api.js`, políticas, gatilhos, índices, chaves estrangeiras, função `cadastro_vinculos` e todas as contagens do banco). O que veio de documento anterior e **não** foi reconferido agora está marcado **Herdado**; o que não foi possível conferir está marcado **Não verificado** (Art. 6 da Constituição). Sem selo, vale como Não verificado. Sem número de linha (envelhece): cita-se arquivo e função.
>
> **Escopo do módulo:** as duas telas do grupo "Cadastros Mestres" do menu (`NAV_GROUPS` em `shell.jsx`): **Clientes** e **Fornecedores**. Matérias-Primas e Produtos (hoje no grupo Fabricação), Empresas Instaladoras (Parceiros & Instaladores), Atualização de Custos (Financeiro & Preços) e Catálogo Siscomex saíram deste grupo e serão documentados nos módulos deles.

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md` ("Como esta numeração funciona"). Aqui vale a mesma: módulo = **3**; telas filhas = **3.1 e 3.2**; o conteúdo comum do módulo fica na **Parte comum**, com prefixo PC-.
- **Tudo o que é janela, aba ou cartão de uma tela pertence a ela**: o modal "Histórico" pertence à 3.1; os cartões "Avaliações" e "Avaliação nas cotações (NPS 0–5)" pertencem à 3.2.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
3. **Cadastros Mestres**
   3.1 Clientes (lista, formulário Novo/Editar, lixeira e modal Histórico)
   &nbsp;&nbsp;&nbsp;3.1.1 O que é · 3.1.2 Rota e arquivos · 3.1.3 Perfil e acesso · 3.1.4 O que a tela mostra · 3.1.5 Botões e controles · 3.1.6 Comportamento · 3.1.7 Dados (lê/grava) · 3.1.8 Regras e armadilhas · 3.1.9 Testes · 3.1.10 Pendências e decisões · 3.1.11 Histórico
   3.2 Fornecedores (lista, formulário Novo/Editar, lixeira, Avaliações e NPS)
   &nbsp;&nbsp;&nbsp;3.2.1 O que é · 3.2.2 Rota e arquivos · 3.2.3 Perfil e acesso · 3.2.4 O que a tela mostra · 3.2.5 Botões e controles · 3.2.6 Comportamento · 3.2.7 Dados (lê/grava) · 3.2.8 Regras e armadilhas · 3.2.9 Testes · 3.2.10 Pendências e decisões · 3.2.11 Histórico
   Parte comum de Cadastros Mestres (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 Como nasce um cadastro (todos os caminhos) · PC-3 Consulta de CNPJ "Omie primeiro" · PC-4 CPF/CNPJ de verdade e documento único · PC-5 Nunca excluir cadastro com transação (🔒) · PC-6 Identidade, alçadas e segurança · PC-7 Gatilhos e rotinas · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
4. Comercial | Pré-venda → `04_comercial_pre_venda.md` (REAL)

## Glossário (módulo Cadastros Mestres)
Termos gerais (soft-delete, alerta, alçada, Nº da cotação) estão no glossário de `01_geral.md`; **Convertido**, **Contribuinte de ICMS** e **Documento pendente** estão no de `02_crm.md`. Não se repetem aqui.
- **Cadastro mestre:** registro único de uma pessoa (cliente) ou empresa (fornecedor) que o resto do site referencia em vez de manter lista própria. Linhas das tabelas `clientes` e `fornecedores`.
- **Código humano / ID-Tag:** `VPCLI-NNNN` (cliente) e `VPFOR-NNNN` (fornecedor). Nasce na criação pela tela, vem de uma sequência do banco e **nunca muda**, nem na edição. O `id` (uuid) também nunca muda. **Exceção hoje: 90 clientes da carga de 19/08/2026 não têm código** (3.1.10, item 13).
- **Razão social / Nome:** nome legal da empresa (PJ) ou da pessoa (PF); o único campo de texto obrigatório nas duas telas.
- **Tipo de pessoa:** `PJ` (CNPJ de 14 dígitos) ou `PF` (CPF de 11). Decide qual campo de documento é lido e gravado (PC-4).
- **Documento único:** o mesmo CNPJ/CPF não pode ter dois cadastros na mesma tabela, ativo ou inativo (PC-4).
- **Categoria (fornecedor):** uma ou mais de **Fornecedor**, **Agente de Carga**, **Transportador** e **Prestador IMS**. Um mesmo fornecedor pode ter várias. Alimenta as listas de escolha de outras telas.
- **Agente de Carga:** empresa que cuida do frete marítimo; é escolhida nas cotações de frete do Embarque. **Prestador IMS:** empresa que presta o serviço contratado na tela IMS da Importação.
- **Omie primeiro:** regra da consulta de CNPJ: olhar o ERP antes da consulta pública (PC-3).
- **Cadastrado no Omie (cliente):** cliente com `codigo_cliente_omie` preenchido. Conta como transação para efeito de exclusão (PC-5).
- **Transação / vínculo:** qualquer coisa que referencia o cadastro (lead, formulário, proposta, P.I., e-mail trocado…). Quem tem transação **não é excluído**, só inativado (PC-5).
- **Inativar:** `ativo = false`. Tira o cadastro das listas de escolha, mas mantém o histórico, o `id` e o código.
- **Vida do Cliente:** o modal Histórico da tela 3.1 (canal de entrada, obras, score).
- **Score de relacionamento:** faixa (Dormente, Estratégico, Recorrente ou Novo) calculada no navegador a partir de obras, equipamentos e datas. **Não é nota numérica.**
- **Avaliação (1–5) × NPS (0–5):** duas avaliações de fornecedor que convivem: a primeira é digitada na tela 3.2 (tabela `fornecedores_avaliacoes`); a segunda nasce nas Cotações de Varejo (tabela `fornecedor_avaliacoes`, 6 critérios) e na 3.2 é só leitura.
- **Nome livre:** fornecedor citado numa RFQ de importação por nome que não casa com um único cadastro (PC-1, 3.2.8).

---

## 3.1 Clientes

### 3.1.1 O que é
O cadastro central de clientes da empresa. Lista todos os clientes (digitados aqui, criados nos bastidores pelo Formulário de Elevador, vindos da conversão de um lead ou do Omie), deixa criar, editar, inativar e excluir (só sem transação) e mostra o histórico de relacionamento de cada um. **Conferido** em `cadastros.jsx` e no banco, 31/10/2026.

**Fora do escopo desta tela:** registrar venda, proposta, contrato ou obra (isso é de Comercial, Jurídico e Engenharia); vincular o cliente a uma obra (feito em Engenharia → Dossiê da Obra); escrever no Omie (a tela só **consulta** o Omie); importar clientes em massa do Omie (a carga de 1.050 clientes com código do Omie foi feita fora desta tela; o mecanismo **não está neste módulo**, Herdado); dar nota numérica ao cliente.

### 3.1.2 Rota e arquivos
- Rota `cadastro-clientes`; URL `/cadastros/cadastro-clientes`, mais `/novo`, `/<id>` ou `/<id>/historico` (**Conferido** em `docs/MAPA_DE_ROTAS.md` e no código). Item "Clientes" do grupo "Cadastros Mestres" do menu; caminho do topo "Cadastros › Clientes"; abre `window.CadastroClientesPage` (`app.jsx`).
- Arquivos: `src/cadastros.jsx` (tela, formulário, modal), `src/cadastros-clientes-store.js` (`window.CadastrosClientesStore`), `src/enderecos-api.js` (validação de documento e consulta de CNPJ). No `index.html` (**Conferido**): `cadastros.jsx` `?v=17`, `cadastros-clientes-store.js` `?v=20`, `enderecos-api.js` `?v=5`. `cadastros.jsx` usa `PIField`, `PIInput` e `PISelect`, que são definidos em `pi.jsx`: **`pi.jsx` precisa carregar antes** (hoje carrega, `?v=26`).
- O estado da tela está na URL: sem sufixo = lista; `/novo` = formulário de cliente novo; `/<id>` = editar aquele cliente; `/<id>/historico` = modal de histórico (hooks `useRotaId` e `useRotaItem`). Voltar/Avançar do navegador e F5 funcionam.

### 3.1.3 Perfil e acesso
- Sem restrição por perfil em `app.jsx` (`RESTRICTED` não tem a rota). O que esconde a tela é a **alocação de grupo** do menu (`gruposAlocados` contendo "Cadastros Mestres"); com o link direto ela abre para quem tem sessão (**Conferido**, leitura de `shell.jsx` e `app.jsx`).
- As alçadas `cadastro-clientes` (ver, criar, editar, excluir) **existem** no catálogo e no banco (31/10/2026: `ver` 23 perfis, `criar` 3, `editar` 3, `excluir` 2), **mas `cadastros.jsx` não chama `temCapacidade` em nenhum ponto**: criar, editar, inativar, excluir e abrir o histórico não dependem da alçada (**Conferido**: busca no arquivo). Ver 3.1.10.
- Isolamento real de dados: **não existe** (PC-6).

### 3.1.4 O que a tela mostra
**Conferido** no código, 31/10/2026.
- Cabeçalho: "Cadastros" / **Clientes** / "Cadastro central de clientes — inclui os criados automaticamente pelo Formulário." e o botão **Novo cliente**.
- Enquanto a lista não chegou, só a mensagem "Carregando…" (sem cabeçalho).
- Aviso amarelo **"Cliente não encontrado."** (com **Voltar à lista**) quando o link tem um id que não está na lista; se a lista veio incompleta, o aviso diz isso.
- Campo de busca **"Buscar por código, nome ou CNPJ/CPF…"** e contador **"N cliente(s) encontrado(s)"**.
- Cartão vermelho **"Lista incompleta"** (com **Tentar de novo**) quando a leitura falhou no meio: diz quantos clientes chegaram.
- Tabela com as colunas **Código · Razão social** (com o nome fantasia embaixo) **· CNPJ/CPF** (formatado; selo amarelo "Doc. pendente" quando marcado) **· Cidade/UF · Contato** (o contato, senão o telefone) **· Status** (Ativo ou selo "Inativo") e a coluna de ações. Todas as colunas, menos a de ações, ordenam ao clicar no título (▲, ▼, ordem original).
- Estado vazio: "Nenhum cliente encontrado."

### 3.1.5 Botões e controles
**Conferido** no código, 31/10/2026. Rótulos exatamente como aparecem.

| Controle | O que faz |
|---|---|
| **Novo cliente** (cabeçalho) | Abre o formulário em branco (`/novo`) e rola até ele |
| Busca | Filtra em memória por razão social, nome fantasia, código, CNPJ ou CPF; o documento casa também com pontuação digitada ("12.345.678/0001-90"), a partir de 3 dígitos |
| Título de coluna | Ordena (▲, ▼, volta à ordem original); texto em pt-BR com números naturais, vazio vai ao fim |
| Ícone **Histórico** | Abre o modal "Histórico · <razão social>" (`/<id>/historico`) |
| Ícone **Editar** | Abre o formulário com os dados daquele cliente (`/<id>`) |
| Ícone **Excluir** (lixeira) | Confere as transações no banco e: com transação oferece **Inativar**; sem transação pede confirmação e exclui (3.1.6) |
| **Tentar de novo** (cartão "Lista incompleta") | Lê a lista de novo |
| **Voltar à lista** (aviso "não encontrado") | Volta para a lista (URL limpa) |

**Formulário "Novo cliente" / "Editar cliente <código>"**

| Campo / controle | Observação |
|---|---|
| **Tipo de pessoa** | `PJ` (padrão) ou `PF`; muda o campo de documento exibido |
| **CNPJ** ou **CPF** | Só o campo do tipo escolhido é lido e gravado. Em PJ há o botão **Buscar CNPJ** (vira "Buscando…") |
| **Inscrição estadual** | Texto livre |
| **Razão social / Nome \*** | Obrigatório |
| **Nome fantasia**, **E-mail**, **Telefone**, **Contato** | Texto livre, sem máscara nem validação de formato |
| **Contribuinte de ICMS? \*** | Lista "Selecione… / Sim — contribuinte (tem inscrição estadual) / Não — não contribuinte"; **obrigatório** |
| Caixa **Documento pendente (CNPJ/CPF ainda não regularizado)** | Marca `documento_pendente`; dispensa a consulta de CNPJ ao salvar |
| Bloco **Endereço** | **Logradouro, Complemento, Bairro, CEP, Cidade, Estado** (lista das 27 UFs); sem busca por CEP |
| Caixa **Cliente ativo** | Marcada por padrão |
| **Cancelar** | Fecha o formulário e volta à lista, sem gravar |
| **Cadastrar cliente** / **Salvar alterações** (vira "Salvando…") | Valida e grava (3.1.6) |

**Modal "Histórico · <razão social>"** (largura 640): três blocos, **Canal de entrada / Vendedor (N)**, **Obras e equipamentos (N)** e **Score de relacionamento**, e o botão **Fechar**.

**Mensagens (toasts) e janelas de confirmação:** "Cliente cadastrado." / "Cliente atualizado." / "Cliente inativado." / "Cliente excluído."; "Erro: …" em qualquer falha; "Informe a razão social / nome."; a pergunta de Contribuinte de ICMS; os avisos da consulta de CNPJ (PC-3). Janelas do navegador na lixeira: uma de **alerta** (cliente inativo com transação) e duas de **confirmação** (Inativar; Excluir definitivamente).

### 3.1.6 Comportamento
**Conferido** no código, 31/10/2026.
1. **Salvar** (ordem exata): (a) consulta de CNPJ, se couber (PC-3); se ela trouxe dado novo, **para** e pede para clicar de novo; (b) razão social vazia → aviso; (c) Contribuinte de ICMS não respondido → aviso; (d) a store valida o documento (PC-4), confere se já existe em outro cadastro, **só então** gera o código (na criação) e grava. Sucesso: volta à lista e recarrega tudo.
2. **Lixeira:** a tela pergunta ao banco quais transações o cliente tem (função `cadastro_vinculos`, PC-5). Se a conferência falhar, **não apaga nada** e mostra o erro. Com transação: lista as fontes e quantidades; se o cliente já está inativo, só avisa que não pode excluir; se está ativo, oferece **Inativar** (confirmação) — o cliente some das listas de escolha, mas o histórico, o `id` e o código ficam. Sem transação: "Excluir definitivamente?" e `DELETE`.
3. **Histórico:** lê leads do cliente (`leads.cliente_id`), as cotações do cliente (`formularios_elevador`) e os dossiês de obra dele (por `cliente_id`, por lead ou por Nº da cotação), com equipamentos e montadores (união de `equipamentos_obra` e `dossier_obra_instaladores`). Mostra "Nenhum lead vinculado a este cliente ainda." e "Nenhuma obra vinculada a este cliente ainda — vincule em Engenharia → Dossiê da Obra → Visão Geral." quando vazio.
4. **Score:** a primeira regra que bater vale: **Dormente** (maior data entre leads e obras anterior a 12 meses), **Estratégico** (3 obras ou mais, ou 5 equipamentos ou mais), **Recorrente** (2 obras), **Novo** (o resto). "Dormente" vem primeiro: cliente com muitas obras e sem atividade há mais de 12 meses aparece como Dormente.
5. Ao abrir o formulário a página rola até ele; o formulário usa `key` por registro, então trocar de cliente sem fechar troca os dados.
6. A lista é lida de 1000 em 1000 (a base tem 1.239 clientes); o recarregamento depois de salvar é **da lista inteira**.

### 3.1.7 Dados — o que lê e o que grava
- **Lê:** `clientes` (todas as colunas); para o Histórico: `leads` (id, building, origin, owner, status, date), `formularios_elevador` (número da cotação), `dossier_obra`, `equipamentos_obra`, `dossier_obra_instaladores` e `parceiros_instaladores` (nome); RPC `cadastro_vinculos`.
- **Grava:** `clientes` (insert, update de edição e de inativação, delete só sem transação); `vp_logs` (módulo "Cadastros": Criou, Editou, Inativou e Excluiu cliente; a exclusão grava só o id). Pelo caminho Lead → Cliente (PC-2) a store também grava `leads.cliente_id` e `quadros_comando.cliente_id`.
- **Herda de:** Leads convertidos, Formulário de Elevador, Omie e BrasilAPI (PC-2 e PC-3).
- **Doa para:** ver o Mapa de ligações (PC-1). Em resumo: Formulário, Proposta, Leads/CRM, Dossiê da Obra, Contratos Social, Contrato do Instalador, Projeto de Elevadores, Precificação (lê Contribuinte de ICMS e Estado), Etiquetas, PCP, Dashboard.

### 3.1.8 Regras e armadilhas
- **Contribuinte de ICMS é obrigatório** na tela: define quem paga o DIFAL nas vendas interestaduais — não contribuinte = a VerticalParts recolhe e o custo entra na Precificação; contribuinte = o próprio cliente recolhe. A Precificação lê esse campo e o Estado do cliente do formulário (**Conferido**).
- **O documento gravado vem do tipo escolhido** (PJ → `cnpj` e `cpf` nulo; PF → o contrário). Não se usa mais "CNPJ ou CPF, o que estiver preenchido" (bug antigo). Detalhe em PC-4.
- **Código só na criação e só depois das conferências**: a falha de uma conferência não gasta número da sequência.
- **Falha da função de código = erro claro**, nunca um código fixo (o `VPCLI-0001` fixo colidiu com um cliente real em 21/09/2026).
- **Conferência de transações com falha = não exclui.** A trava vale também no banco (PC-5), então vale mesmo fora da tela.
- O campo `endereco` (texto), `cidade` e `estado` de `clientes` são montados/duplicados a partir das partes `endereco_*` para compatibilidade com consumidores antigos.
- Hooks do componente vêm todos **antes** do `return` de "Carregando…" (padrão de `01_geral.md` PC-9, **Conferido**).
- Toda criação, edição, inativação e exclusão grava em `vp_logs` se `window.VPLog` existir.

### 3.1.9 Testes
- `src/cadastros-nunca-excluir.test.js` (21 blocos `test`, alguns repetidos para clientes e fornecedores): exclusão com transação, falha de conferência, exclusão sem transação, inativar; leitura de 1000+ linhas e falha no meio; documento repetido (grava, editar com o de outro, recusa do índice único, sem documento); desempate de homônimo do Lead. `src/cadastros-clientes-vincula-quadros.test.js` (4), `src/proposta-lead-cliente.test.js` (7) e `src/enderecos-api.test.js` (3). **Rodei `npm test` em 31/10/2026 (de novo, sobre `980586c`): 920 passaram, 0 falharam** (suíte inteira). A rota entra sozinha no teste de fumaça do e2e (`KNOWN_ROUTES`); **não rodei o e2e** (roda no CI). **Não há teste de componente** para `cadastros.jsx`: formulário, lista, modal e lixeira não têm teste automatizado.
- **Cenários de aceitação** (os que têm teste de apoio dizem qual):
  1. *Dado* um cliente com proposta, *quando* alguém clica na lixeira, *então* a tela lista as transações e só oferece Inativar (`cadastros-nunca-excluir`).
  2. *Dado* que a conferência de transações falha, *quando* alguém clica na lixeira, *então* nada é excluído e aparece o erro (`cadastros-nunca-excluir`).
  3. *Dado* um CNPJ já usado por outro cliente, *quando* alguém tenta cadastrar, *então* a gravação é recusada dizendo qual cadastro usa o número (`cadastros-nunca-excluir`).
  4. *Dado* PF com um CNPJ digitado, *quando* salva, *então* a store recusa e a mensagem diz que o número parece um CNPJ e sugere trocar o tipo (`enderecos-api`, que testa a validação; a exibição na tela não tem teste).
  5. *Dado* um link para um cliente que não existe, *quando* abre, *então* aparece "Cliente não encontrado." com **Voltar à lista**. **Sem teste automatizado** (Conferido só por leitura do código).
  6. *Dado* um lead Convertido com nome igual ao de 2 clientes, *quando* converte, *então* vincula pelo e-mail ou pelo telefone, preferindo o ativo (`cadastros-nunca-excluir`).

### 3.1.10 Pendências e decisões
Todos são **achados, sem correção** (Art. 45), salvo onde dito.
1. **A alçada do módulo não é conferida na tela.** O catálogo tem `cadastro-clientes` com ver/criar/editar/excluir e há perfis concedidos, mas qualquer pessoa com sessão que abra o link cria, edita, inativa e exclui (sem transação). **Decisão do Gelson:** ligar as quatro ações às alçadas ou manter assim.
2. **1.208 dos 1.239 clientes têm Contribuinte de ICMS vazio** (banco, 31/10/2026). Como a tela exige a resposta, **editar qualquer um desses clientes obriga a responder Sim ou Não** antes de salvar (até para corrigir um telefone). Inativar pela lixeira não passa por essa exigência.
3. **Histórico ignora erro de consulta:** `historicoCliente` lê `leads`, `formularios_elevador`, `dossier_obra`, `equipamentos_obra` e o elenco sem olhar o erro; falha vira "Nenhum lead/obra vinculado", indistinguível de vazio. **Conferido** no código.
4. **Mensagem do Score com data pura:** `leads.date` é do tipo `date` (o banco devolve `aaaa-mm-dd`) e o cálculo faz `new Date(l.date)` e depois `toLocaleDateString('pt-BR')`; no fuso do Brasil a data pode aparecer **um dia antes** na frase "Sem obra ou lead novo desde …". Conferido no código e no tipo da coluna; **o efeito na tela não foi reproduzido**. Benefício vindo do CRM (PC-12).
5. **Datas em formatos diferentes no modal Histórico:** a data do lead aparece como texto cru (`aaaa-mm-dd`) e a da obra em `dd/mm/aaaa`. Estético. **Conferido** no código.
6. **Salvar recarrega a lista inteira** (2 páginas de 1000). Padrão de atualizar só a linha (`01_geral.md` PC-9) não foi aplicado. Pendência de melhoria.
7. **Busca só em memória:** toda abertura da tela lê os 1.239 clientes. Hoje funciona; cresce com a base.
8. **Sem validação de formato** de e-mail, telefone e CEP; o campo CEP não chama `EnderecoAPI.buscarCEP` (a função existe). **Conferido**.
9. **"Cliente cadastrado" no Dashboard/Linha do Tempo sempre sai com o ator "Vendedor":** a store não grava `criado_por` (a coluna é uuid de `auth.users`) e o gatilho `trg_evfluxo_cliente_cadastrado` usa essa coluna para achar o nome. Banco: 4 eventos, todos "Vendedor" (31/10/2026). A coluna `criado_por` tem valor em 83 dos 1.239 clientes (gravados antes, por outro caminho); nenhum código atual a grava.
10. **Índices repetidos:** `clientes_cnpj_key` (único em todo `cnpj`) convive com `clientes_cnpj_unico` (único parcial), e o mesmo ocorre em `fornecedores` (PC-8). Sem efeito prático hoje; só poluição.
11. **Ajuda do "?" está curta** e o tutorial está desatualizado (PC-10).
12. **Duas implementações da consulta "Omie primeiro"** (esta tela e a de Leads): PC-3.
13. **90 clientes estão sem código (`codigo` nulo), 7,3% da base** (banco, 31/10/2026: 90 de 1.239; 19 deles têm código do Omie; nenhum inativo). Todos foram criados no mesmo intervalo de 6 minutos, em **19/08/2026 (11:33 a 11:39)**, ou seja, na carga em lote, não pela tela (a tela sempre gera o código, 3.1.8). Esses cadastros aparecem com "—" na coluna Código e **ficam fora do desempate e de qualquer busca pelo código `VPCLI`**. **Separado e ainda possível hoje:** o arquivo da Edge Function `capturar-lead-quadro-comando` insere o cliente com `codigo` nulo quando `gerar_codigo_cliente` falha (**Conferido** no arquivo do repositório; a versão no ar, v10, não foi comparada com ele). A sequência está em 1.161 e o maior código é `VPCLI-1161`; **não** verifiquei se os 90 nulos têm lacuna correspondente na numeração. Achado, sem correção: dar código a esses 90 é decisão do Gelson (mexe em `id`/código de cadastro: Art. 16).

### 3.1.11 Histórico (só o que ainda ensina)
- **27/09/2026:** "Editar" parecia não funcionar porque o formulário abre no topo e a lista tem mais de 1.200 linhas; passou a rolar até o formulário e a usar `key` por registro. Vale para qualquer lista longa com formulário no topo.
- **14/09/2026:** a lista parava em 1.000 (limite do PostgREST) depois da importação do Omie; passou a ler em páginas. **31/10/2026:** passou a avisar quando a leitura falha no meio.
- **14/09/2026:** `documento_pendente` existia na tabela mas a tela não deixava ver nem limpar; hoje é caixa do formulário e selo da lista.
- **21/09/2026:** `VPCLI-0001` fixo como reserva do código colidiu com um cliente real; hoje a falha da função é erro claro.
- **04/10/2026:** CPF/CNPJ com dígito verificador e coerente com o tipo (PC-4); todos os 1.043 CNPJ e 75 CPF da época eram válidos.
- **31/10/2026:** nunca excluir com transação, documento único, busca com pontuação, aviso de cadastro inexistente e desempate de homônimo do lead (PC-4, PC-5, 3.1.6). Decisões do Gelson em PC-5.

---

## 3.2 Fornecedores

### 3.2.1 O que é
O cadastro **único** de fornecedores: o mesmo cadastro serve a Fornecedor, Agente de Carga, Transportador e Prestador IMS, separados pelas **categorias** marcadas, em vez de um cadastro por tipo de prestador. Deixa criar, editar, inativar, excluir (só sem transação) e avaliar. **Conferido** em `cadastros.jsx` e no banco, 31/10/2026.

**Fora do escopo desta tela:** cotar, comprar ou pagar (isso é de Importação, Cotações de Varejo e Embarques); gravar a nota NPS (nasce nas Cotações de Varejo); campos fiscais do cliente (Inscrição estadual, Contribuinte de ICMS e Documento pendente **não existem** em fornecedor); contato por e-mail ou histórico de e-mails (o Inbox é de Geral).

### 3.2.2 Rota e arquivos
- Rota `cadastro-fornecedores`; URL `/cadastros/cadastro-fornecedores`, mais `/novo` ou `/<id>` (**Conferido** em `docs/MAPA_DE_ROTAS.md` e no código). Item "Fornecedores" do grupo "Cadastros Mestres"; abre `window.CadastroFornecedoresPage`. **Não há** modal de histórico nem rota de histórico para fornecedor.
- Arquivos: `src/cadastros.jsx` (`CadastroFornecedoresPage`, `FornecedorForm`, `FornecedorAvaliacoes`, `FornecedorNPS`), `src/cadastros-fornecedores-store.js` (`window.CadastrosFornecedoresStore`, `?v=11`), `src/enderecos-api.js`. O cartão NPS depende de `window.CotacoesVarejoStore` (`cotacoes-varejo-store.js`, `?v=10`) e de `window.NpsMini`; se um deles não existir, o cartão simplesmente não aparece.

### 3.2.3 Perfil e acesso
- Mesma situação da 3.1.3: sem `RESTRICTED`; só a alocação de grupo esconde o menu; as alçadas `cadastro-fornecedores` existem (banco, 31/10/2026: `ver` 17 perfis, `criar` 6, `editar` 6, `excluir` 2) e **a tela não as consulta**. Ver 3.2.10.
- As listas de escolha que outras telas montam (`listarAtivos`) só mostram fornecedores **ativos**.

### 3.2.4 O que a tela mostra
**Conferido** no código, 31/10/2026.
- Cabeçalho: "Cadastros" / **Fornecedores** / "Cadastro único — Fornecedor, Agente de Carga, Transportador e Prestador IMS, marcados por categoria." e o botão **Novo fornecedor**.
- "Carregando…", aviso **"Fornecedor não encontrado."** e cartão **"Lista incompleta"** funcionam como na 3.1.4.
- Busca **"Buscar por código, nome ou CNPJ…"** e lista **"Todas as categorias"** + as 4 categorias; contador **"N fornecedor(es) encontrado(s)"**.
- Tabela: **Código · Razão social** (com fantasia) **· Categorias** (um selo por categoria) **· CNPJ/CPF · Contato · Avaliação** (estrelas e média; "—" sem avaliação) **· Status** e as ações. Colunas ordenáveis (exceto ações). Estado vazio: "Nenhum fornecedor encontrado."
- As estrelas da lista **arredondam para baixo** de propósito (média 4,5 = 4 estrelas cheias, com o número exato ao lado), para não superestimar a nota.

### 3.2.5 Botões e controles
**Conferido** no código, 31/10/2026.

| Controle | O que faz |
|---|---|
| **Novo fornecedor** | Abre o formulário em branco (`/novo`) e rola até ele |
| Busca e lista de categoria | Filtram em memória (a categoria exige que o fornecedor a tenha marcada) |
| Título de coluna | Ordena |
| Ícone **Editar** | Abre o formulário (`/<id>`) |
| Ícone **Excluir** (lixeira) | Igual à 3.1: confere transações; com transação oferece Inativar |
| **Tentar de novo**, **Voltar à lista** | Igual à 3.1 |

**Formulário "Novo fornecedor" / "Editar fornecedor <código>"**

| Campo / controle | Observação |
|---|---|
| **Categorias \*** | Quatro "pílulas" (Fornecedor, Agente de Carga, Transportador, Prestador IMS); **ao menos uma** |
| **Tipo de pessoa**, **CNPJ** ou **CPF**, **Buscar CNPJ** | Igual à 3.1 |
| **Razão social / Nome \*** | Obrigatório |
| **Nome fantasia**, **E-mail**, **Telefone**, **Contato** | Texto livre, sem validação de formato |
| Bloco **Endereço** | Os mesmos 6 campos da 3.1 |
| **Observações** | Texto livre (2 linhas) |
| Caixa **Fornecedor ativo** | Marcada por padrão |
| **Cancelar** / **Cadastrar fornecedor** ou **Salvar alterações** | Como na 3.1 |

**Cartões que aparecem só ao editar (abaixo do formulário):**
- **Avaliações** — lista **Nota** (1 a 5), **Comentário** ("Opcional"), botão **Avaliar** (vira "Salvando…"), histórico de avaliações com lixeira por linha (confirmação "Remover esta avaliação?"). Subtítulo "Média: ★★★★☆ (4.0) · N avaliação(ões)" ou "Nenhuma avaliação ainda."
- **Avaliação nas cotações (NPS 0–5)** — só leitura: o resumo do `NpsMini` e as 8 avaliações mais recentes, ou "Nenhuma avaliação ainda — elas nascem em Cotações de Varejo, no cartão do fornecedor."

**Mensagens:** "Fornecedor cadastrado." / "Fornecedor atualizado." / "Fornecedor inativado." / "Fornecedor excluído."; "Informe a razão social / nome."; "Selecione ao menos uma categoria."; "Erro: …".

### 3.2.6 Comportamento
**Conferido** no código, 31/10/2026.
1. **Salvar** (ordem): consulta de CNPJ (PC-3) → razão social → ao menos uma categoria → a store valida o documento (PC-4), confere documento único, gera o código (RPC) e grava. A criação grava `criado_por` com o e-mail da sessão (só 14 dos 82 fornecedores têm esse campo preenchido; os demais são anteriores a essa gravação).
2. **Lixeira:** igual à 3.1.6 (2), com a diferença de que as fontes de transação de fornecedor são muitas e algumas **casam pelo nome** (PC-5).
3. **Avaliar:** nota de 1 a 5 e comentário opcional; o autor gravado é o nome ou o e-mail da sessão. **Remover avaliação** apaga a linha (sem soft-delete).
4. **NPS:** lê `CotacoesVarejoStore.avaliacoesDoFornecedor(id, nome)`; é a nota que o comprador dá ao fechar uma cotação de varejo.
5. **Média na lista:** vem de uma segunda leitura (`mediasAvaliacoes`, de 1000 em 1000); se ela falhar, a lista aparece sem estrelas (sem aviso).

### 3.2.7 Dados — o que lê e o que grava
- **Lê:** `fornecedores` (todas as colunas), `fornecedores_avaliacoes`, RPC `cadastro_vinculos`; no NPS, `fornecedor_avaliacoes` (via `CotacoesVarejoStore`).
- **Grava:** `fornecedores` (insert, update, delete só sem transação), `fornecedores_avaliacoes` (insert e delete) e `vp_logs` ("Criou", "Editou", "Inativou", "Excluiu fornecedor"; "Avaliou fornecedor", "Removeu avaliação de fornecedor").
- **Herda de:** digitação e consulta de CNPJ (PC-3); **não** há conversão automática (diferente do cliente).
- **Doa para:** Formulário/RFQ de elevador, P.I., Embarques (cotações de frete e agente/desembaraço), Cotações de Varejo, RFQ de importação, Tratativas (PC-1).

### 3.2.8 Regras e armadilhas
- **Categorias são lista de texto** (`categorias`): o banco não restringe os valores, quem restringe é a lista `CATEGORIAS` da store (**Conferido**: só há CHECK de `tipo_pessoa`).
- **`listarAtivos(categoria)`** devolve só os ativos, ordenados por razão social, com `id, codigo, razao_social, nome_fantasia, categorias, email, telefone, contato`; usa `contains` na categoria. **Não foi paginado de propósito**: é peça da Área Blindada do E-mail/RFQ e a base (82) está longe do limite de 1000.
- **Vínculo por id ao lado do nome** (decisão do Gelson, 31/10/2026): P.I. e Embarque guardam `fornecedor_id`/`agente_carga_id`/`empresa_desembaraco_id` (FK com `RESTRICT`) além do nome digitado. O id só é preenchido quando o nome bate **exatamente** (sem acento, maiúscula ou espaço extra) com a razão social ou o fantasia de **um único** cadastro; dois cadastros com o mesmo nome, nome parcial ou falha de leitura = sem id (nunca chuta; mantém o id anterior se o nome ainda bate com ele). A RFQ de importação segue a mesma regra: casou, guarda `cadastro_id` e `cadastro_codigo`; não casou, só entra com confirmação e fica marcada `nome_livre`. **Não houve carga retroativa**: P.I. e embarques antigos ficam sem id até serem salvos de novo.
- **Duas avaliações convivem sem unificar** (nota única 1–5 editável aqui; NPS 0–5 de 6 critérios só leitura). Decisão pendente do Gelson (3.2.10).
- **Fornecedor sem CNPJ/CPF é permitido** (documento vazio não é conferido); só 3 dos 82 têm CNPJ (3.2.10).
- Não há "documento pendente" em fornecedor: CNPJ inválido sempre bloqueia o salvar.

### 3.2.9 Testes
- Os mesmos arquivos da 3.1.9 cobrem fornecedores: `cadastros-nunca-excluir.test.js` (exclusão com transação, falha de conferência, inativar, 1000+ linhas, falha no meio, média de avaliação em duas páginas, código vindo do banco e sem `VPFOR-0001` fixo, documento repetido, ligação pelo nome e `rfq.jsx` com `cadastro_id`/`nome_livre`). Suíte: **920 passaram, 0 falharam** (31/10/2026, sobre `980586c`). Sem teste de componente.
- **Cenários de aceitação:**
  1. *Dado* um fornecedor com P.I., *quando* alguém clica na lixeira, *então* só pode inativar (`cadastros-nunca-excluir`).
  2. *Dado* que a função de código falha, *quando* cadastra, *então* aparece erro claro e **nenhum** `VPFOR-0001` é inventado (`cadastros-nunca-excluir`).
  3. *Dado* um nome que bate com dois cadastros, *quando* o vínculo é resolvido (P.I., embarque), *então* o resultado é sem id (`cadastros-nunca-excluir`, que testa a regra de ligação pelo nome).
  4. *Dado* uma lista de 1.005 fornecedores, *quando* a store lê, *então* traz as 1.005 (`cadastros-nunca-excluir`).
  5. *Dado* que a leitura da lista falha no meio, *quando* a store lê, *então* devolve o erro junto (`cadastros-nunca-excluir`); o cartão "Lista incompleta" que aparece na tela **não tem teste**.

### 3.2.10 Pendências e decisões
Achados, sem correção, salvo onde dito.
1. **Alçada não conferida na tela** (igual à 3.1.10, item 1). **Decisão do Gelson.**
2. **79 dos 82 fornecedores não têm CNPJ nem CPF** (banco, 31/10/2026: 3 CNPJ, 0 CPF). Sem documento, o índice único não protege duplicata por nome e a consulta "Omie primeiro" nunca roda; o nome vira a única chave dos vínculos antigos.
3. **Duas avaliações de fornecedor** coexistem (`fornecedores_avaliacoes` e `fornecedor_avaliacoes`); as duas estão vazias hoje (0 linhas). **Decisão do Gelson:** unificar ou manter.
4. **Remover avaliação** (lixeira do cartão) não trata erro: se o banco recusar, o erro não aparece. **Conferido** no código.
5. **Vínculos antigos só por nome:** P.I., embarques, cotações de elevador, unidades do Formulário, expedições, IMS, RFQ de importação e pedidos a fornecedor citam o fornecedor por nome; a trava de exclusão os acha por aproximação de nome (PC-5), mas renomear o cadastro rompe a ligação por nome. Parte foi tratada pela coluna de id; o resto não.
6. **Leitura direta fora da store:** as Tratativas leem `fornecedores` (nome, fantasia e e-mail, até 2.000 linhas) e casam o nome por aproximação para achar o e-mail da cotação. **Conferido** (`tratativas-store.js`).
7. **PCP não usa o cadastro:** a tabela `pcp_produto_fornecedor` (fornecedor em texto) tem 0 linhas e nenhum código a lê ou grava (decisão do Gelson em 31/10/2026: documentar e não criar vínculo agora). Regra para quando o PCP passar a usar fornecedor por produto: guardar o **id do cadastro** ao lado do nome e incluir a tabela em `cadastro_vinculos` (PC-5); não criar outra lista de fornecedores.
8. **Média de avaliação sem aviso de erro** (3.2.6, item 5).
9. **Sem validação de e-mail, telefone e CEP**; sem busca por CEP (igual à 3.1).
10. **Ajuda curta e tutorial desatualizado** (PC-10).
11. **Nenhum gatilho de identidade em `fornecedores`** (e em `clientes`): só há os de exclusão (e o evento "cliente cadastrado"); `id` e código "nunca mudam" só por convenção do front. **Conferido** (lista de gatilhos, 31/10/2026; não testei um UPDATE). Benefício vindo de Comercial | Pré-venda (`01_geral.md` PC-9). Achado, sem correção (vale também para 3.1).

### 3.2.11 Histórico (só o que ainda ensina)
- **31/10/2026 (T3):** o código `VPFOR` era "maior código + 1" lido no navegador, com `VPFOR-0001` fixo se o banco falhasse; passou para a sequência do banco (RPC `gerar_codigo_fornecedor`). Sequência em 82, próximo `VPFOR-0083`.
- **31/10/2026 (T4):** a lista de fornecedores não era paginada (teto de 1000); passou a ler em páginas e avisar quando falha no meio.
- **31/10/2026 (T6 e T5):** vínculo por id em P.I., Embarque e RFQ de importação (coluna nova, sem trocar o texto).
- **Média de estrelas arredondava 4,5 para 5**; passou a arredondar para baixo.

---

## Parte comum de Cadastros Mestres

### PC-1 Mapa de ligações
**Conferido** por busca no código em 31/10/2026 (função/arquivo, sem número de linha).

**Clientes — quem usa:**
| Consumidor | Como usa |
|---|---|
| Formulário de Elevador (`formulario-elevador.jsx`, `formulario-elevador-store.js`) | `listarTodos` e `obter` para escolher o cliente; `gerarCodigo`; **cria cliente nos bastidores** (`buscarOuCriarCliente`) ao preencher CNPJ/razão social, **por insert próprio**, não pela `criar` da store |
| Proposta (`proposta-store.js`) | `criarOuVincularDeLead` ao assinar; confere se o `cliente_id` existe |
| Leads/CRM (`comercial.jsx`, `crm.jsx`) | `criarOuVincularDeLead`, `vincularQuadrosDoLead`; grava as colunas do Omie em `clientes` (`gravarOmieNoCliente`, PC-12) |
| Dossiê da Obra (`dossier-obra.jsx`) | `listarTodos` para vincular o dossiê ao cliente |
| Contratos Social (`contratos-sociais.jsx`) | `listarTodos` para achar o cliente ao salvar o PDF |
| Contrato do Instalador (`contrato-instalador.jsx`) | `listarTodos` |
| Projeto de Elevadores (`projeto-elevador-store.js`) | `listarTodos` para resolver o cliente por documento |
| Precificação (`precificacao-elevador-store.js`) | Lê `contribuinte_icms` e `endereco_estado` do cliente do formulário (DIFAL); monta o link `/cadastros/cadastro-clientes/<id>` |
| Dashboard (`supabase.js`), Etiquetas (`etiquetas-store.js`), PCP (`pcp.jsx`) | Leem `clientes` direto, só para mostrar nome |
| Edge Function `capturar-lead-quadro-comando` | **Acha o cliente pelo CNPJ ou cria** um (formulário público do Quadro de Comando, quando o CNPJ já está no Omie) e grava nele os dados do Omie (PC-2, item 5; `02_crm.md` PC-2) |

**Fornecedores — quem usa:**
| Consumidor | Como usa |
|---|---|
| Formulário de Elevador / RFQ (`formulario-elevador.jsx`) | `listarAtivos('Fornecedor')`: e-mail, telefone e contato do cadastro substituíram um mapa fixo no código |
| P.I. (`pi.jsx`, `pi-store.js`) | `listarAtivos(categoria)` para a lista de escolha; `resolverIdPorNome` grava `fornecedor_id` |
| Embarques (`embarques-importacao-store.js`, `embarques-frete-cotacoes.jsx`) | `resolverIdPorNome` para agente de carga e desembaraço; `listarAtivos('Agente de Carga')` (ou todos) nas cotações de frete |
| Cotações de Varejo (`cotacoes-varejo-store.js`) | `listarAtivos()` sem filtro; o botão "+ Cadastrar novo fornecedor" leva a esta tela |
| RFQ de importação (`rfq.jsx`) | `resolverPorNome` (`cadastro_id`, `cadastro_codigo`, `nome_livre`) |
| Tratativas (`tratativas-store.js`) | Leitura direta de `fornecedores` (3.2.10, item 6) |

### PC-2 Como nasce um cadastro (todos os caminhos)
**Cliente:**
1. **Digitado nesta tela** (3.1).
2. **Formulário de Elevador**, nos bastidores, quando alguém informa CNPJ/CPF e razão social. Acha o cliente pelo documento (devolve o existente sem alterar, só completando Contribuinte de ICMS vazio); com um "cliente provisório" já criado na mesma sessão, **atualiza** esse registro; senão cria com o código da sequência. **Conferido.**
3. **Lead Convertido** (`criarOuVincularDeLead`): idempotente por `leads.cliente_id`; sem vínculo, busca por razão social **exata** (até 20 homônimos; desempata pelo e-mail do lead, depois pelos 8 últimos dígitos do telefone, depois o ativo; sem desempate fica o primeiro e avisa no console) e, se não achar, **cria** com `razao_social` = prédio do lead (ou o contato). O lead não tem CNPJ, então o desempate é "o melhor possível". Depois grava `leads.cliente_id` e aponta `quadros_comando.cliente_id` dos pedidos de quadro do lead que ainda não têm cliente. Detalhe do lado do lead em `02_crm.md` PC-3.
4. **Omie:** 1.050 clientes têm `codigo_cliente_omie` (banco, 31/10/2026). O mecanismo que os trouxe **não está neste módulo** (Herdado).
5. **Formulário público do Quadro de Comando** (Edge Function `capturar-lead-quadro-comando`, do repositório): quando o CNPJ informado já é cliente no Omie, a função **acha o cliente local pelo CNPJ** (e grava nele `codigo_cliente_omie`, `omie_cadastrado_desde` e `omie_verificado_em`) ou, se não existir, **cria** um cliente PJ com o nome do Omie, o contato e o código pedido à função `gerar_codigo_cliente`. **Conferido** no arquivo do repositório; a versão no ar (v10) pode diferir do arquivo (o repositório já esteve defasado em outras funções): **Não verificado**. Se a função de código falhar, o arquivo grava o cliente com `codigo` **nulo** em vez de parar com erro (3.1.10, item 13).

**Fornecedor:** só digitado nesta tela (3.2); as Cotações de Varejo só convidam quem já existe no cadastro (**Herdado** de `CLAUDE.md`).

### PC-3 Consulta de CNPJ "Omie primeiro"
**Conferido** em `enderecos-api.js` e `cadastros.jsx`, 31/10/2026. Vale para Clientes e Fornecedores; a tela de Leads tem implementação própria (`02_crm.md` PC-4) e o Formulário de Elevador usa a mesma função desta (Herdado).
1. CNPJ inválido (dígito verificador) → não chama nada, devolve "CNPJ inválido — confira os dígitos."
2. Chama a Edge Function **`omie-buscar-cliente`** (`verify_jwt` ligado, versão 7 no ar); o front **nunca** fala direto com o Omie. Respostas: `encontrado: true`, `false` ou `null` (falha de consulta, **nunca** "não cadastrado"). Mensagens distinguem HTTP 401 ("sessão sem permissão pra consultar o ERP") de outros status.
3. Encontrado → fonte `omie`; **só** razão social, fantasia, telefone, e-mail e situação (ativo/inativo) — o Omie **não devolve endereço**.
4. Não encontrado ou falha → BrasilAPI (timeout de 5 s): 404 = "CNPJ não encontrado."; outras falhas = "Serviço de consulta de CNPJ temporariamente indisponível." Sucesso → fonte `externo`, com endereço completo, situação cadastral e CNAEs.
5. A função **nunca lança**; devolve `{ fonte, omie, dados, erro }`.

**No formulário (`cadConsultarCnpj` e `useCnpjOmieFirst`):**
- O resultado preenche **só campos vazios** (razão social, fantasia, telefone, e-mail e os 6 de endereço); nunca sobrescreve o digitado.
- **Buscar CNPJ:** exige CNPJ válido; avisa a fonte ("CNPJ já cadastrado no ERP Omie — dados trazidos de lá." ou "CNPJ não está no Omie — dados trazidos da consulta pública.").
- **Consulta ao salvar:** pula PF, "Documento pendente" (só existe em cliente) e campo vazio; CNPJ inválido bloqueia ("CNPJ inválido — confira os dígitos (ou marque 'documento pendente')."); se já foi consultado nesta abertura, segue; senão consulta e, **se trouxe dado novo, para** com "Dados preenchidos pela consulta de CNPJ. Confira e clique em salvar de novo."; se não trouxe nada novo ou a consulta falhou (só aviso "Confira os dados manualmente"), **deixa salvar**.
- Em fornecedor o estado do formulário não tem `documento_pendente`, então um CNPJ inválido sempre bloqueia.

### PC-4 CPF/CNPJ de verdade e documento único
**Conferido** em `enderecos-api.js` e nas duas stores, 31/10/2026.
- **Validação (`validarDocumento(tipo, valor)`):** vazio é aceito (documento pendente); o tamanho precisa combinar com o tipo (PF = 11, PJ = 14) e a mensagem sugere trocar o tipo quando o número parece do outro ("parece um CNPJ"); os **dois dígitos verificadores** conferem (recusa sequência repetida, como `000.000.000-00`). As duas stores validam **antes de gravar** e lançam o erro; sem o módulo carregado, aceitam só os dígitos.
- **Documento gravado pelo tipo escolhido** (PJ: `cnpj`, `cpf` nulo; PF: o contrário). Só dígitos no banco.
- **Documento único (31/10/2026):** antes de criar ou editar, a store procura o mesmo documento em **outro** cadastro (inativo também conta) e recusa com o código e a razão social de quem o usa, avisando "reative esse cadastro em vez de criar outro" se estiver inativo. Falha ao conferir = nada é gravado. Na criação a conferência roda **antes** de gerar o código. O banco reforça com índices únicos parciais (PC-8); a recusa do índice (código `23505`) vira a mesma mensagem clara. Medição de 31/10/2026: 0 documentos repetidos.
- Observação: o Formulário de Elevador cria cliente por insert próprio e **não** passa pela conferência da store; quem o protege é o índice do banco (**Conferido** no código).

### PC-5 Nunca excluir cadastro com transação (🔒 Área Blindada)
A **lei** está no `CLAUDE.md` (Art. 16 e a seção "🔒 ÁREA BLINDADA — Cadastros Mestres"): cliente ou fornecedor com qualquer transação pode ser editado, mas **nunca excluído**; `id` e código nunca mudam; retirar de circulação é `ativo = false`; exclusão física só sem nenhum vínculo, conferido antes; falha ao conferir = não apaga. Se pedirem para "limpar", "unificar" ou "apagar" cadastros, **pare**, informe a lei e peça confirmação. **Este documento descreve como a lei é cumprida; não a afrouxa.**

**Conferido** no banco e no código, 31/10/2026:
- **Função `cadastro_vinculos(tipo, id)`** (SQL, `SECURITY DEFINER`, estável): fonte única das transações. Para **cliente** conta leads, formulários/cotações, dossiês de obra, contratos sociais, propostas, pedidos de Quadro de Comando, desenhos do Projeto de Elevadores, "Cadastrado no ERP Omie" (se tem código do Omie) e pedidos de venda do Omie. Para **fornecedor** conta convites de cotação de varejo, cotações de frete, avaliações (as duas tabelas), P.I., embarques (agente e desembaraço), cotações de elevador (pelo nome), unidades do Formulário (pelo nome), expedições (transportadora, pelo nome), IMS, RFQ de importação e pedidos a fornecedor. Para os dois conta também os **e-mails trocados** (Inbox) com o endereço de e-mail do cadastro. Casamento por nome usa normalização sem acento/maiúscula.
- **Gatilho `BEFORE DELETE`** em `clientes` e `fornecedores` (`cadastro_bloquear_exclusao`): recusa o `DELETE` listando os vínculos; vale mesmo fora da tela (SQL, MCP). A recusa real de um `DELETE` **não foi testada** (exigiria comando destrutivo).
- **Chaves estrangeiras:** `propostas`, `quadros_comando` (para `clientes`) e `fornecedores_avaliacoes`, `pi_importacao`, `embarques_importacao` ×2 (para `fornecedores`) estão em `RESTRICT`; `leads`, `dossier_obra`, `formularios_elevador` e `contratos_sociais` em `NO ACTION`. Antes de 31/10/2026 três delas apagavam em silêncio (`SET NULL` e `CASCADE`).
- **Números (Conferido em 31/10/2026, rodando `cadastro_vinculos` em cada linha):** 99 de 1.239 clientes e 59 de 82 fornecedores não têm nenhuma transação; só esses podem ser excluídos.
- **Decisões do Gelson (Clarify, 31/10/2026):** (a) cliente vindo do Omie conta como transação, mesmo sem vínculo no site; (b) fornecedor citado só pelo nome conta como transação, principalmente se houve troca de e-mails; (c) a trava vale também no banco.
- **Razões sociais repetidas em `clientes`** (analisadas em 13/10/2026, **Herdado**): 59 grupos; 36 têm um cadastro antigo sem CNPJ e sem nenhuma ligação ao lado de outro com CNPJ; os outros 23 são filiais com CNPJ e código do Omie próprios (não são duplicata). **Mantidas por decisão do Gelson**: não unificar nem desativar sem pedido novo. Se um dia for pedido, a proposta registrada é só `ativo = false` nos 36 sem CNPJ e sem ligação, nunca nas filiais, depois de confirmar que nenhum é usado fora do sistema.

### PC-6 Identidade, alçadas e segurança
- **Estado real da segurança (banco, 31/10/2026):** `clientes` tem RLS ligada com uma política `ALL` liberada a `anon` e outra a `authenticated` (`qual = true`); `fornecedores` e `fornecedores_avaliacoes` têm RLS ligada com leitura, inclusão, alteração e exclusão liberadas a `public` (`true`). **Qualquer pessoa com a chave pública lê e escreve nas três tabelas.** A tabela do NPS (`fornecedor_avaliacoes`, nasce nas Cotações de Varejo) é a exceção: RLS ligada, só `authenticated`, com leitura e inclusão (sem alteração nem exclusão). Trava na tela é organização, não segurança (Art. 25); o isolamento verdadeiro é a issue #571 (`01_geral.md` PC-6). A **trava de exclusão** (PC-5) é a única proteção que vale também fora da tela.
- **Alçadas:** ver 3.1.3 e 3.2.3. Existem no catálogo e no banco; a tela não as consulta.
- **Identidade nos registros:** `fornecedores.criado_por` guarda o e-mail da sessão; `clientes.criado_por` é uuid de `auth.users` e **nunca é gravado** (3.1.10, item 9).

### PC-7 Gatilhos e rotinas
- `trg_evfluxo_cliente_cadastrado` (`AFTER INSERT` em `clientes`): grava o evento "Cliente cadastrado" (módulo Comercial) em `eventos_fluxo`; falha engolida de propósito. **Conferido** (4 eventos até 31/10/2026).
- `trg_clientes_bloquear_exclusao` e `trg_fornecedores_bloquear_exclusao` (`BEFORE DELETE`): PC-5.
- **Não há** job de `pg_cron` que cite `clientes`/`fornecedores` e **nenhuma** das três tabelas está no Realtime (banco, 31/10/2026): a tela só atualiza ao abrir, ao salvar ou em "Tentar de novo".

### PC-8 Tabelas
- **`clientes`** (1.239 linhas em 31/10/2026; 1 inativo; 3 com documento pendente; 1.060 com CNPJ e 75 com CPF; 1.050 com código do Omie): `id`, `codigo`, `razao_social`, `nome_fantasia`, `tipo_pessoa`, `cnpj`, `cpf`, `inscricao_estadual`, `contribuinte_icms`, `documento_pendente`, `email`, `telefone`, `contato`, os 6 `endereco_*`, `endereco`/`cidade`/`estado` (compatibilidade), `ativo`, `criado_por`, `criado_em`, `atualizado_em`, `codigo_cliente_omie`, `omie_cadastrado_desde`, `omie_verificado_em`. CHECK só em `tipo_pessoa`. Índices: único em `codigo` (aparece **duas vezes**: `idx_clientes_codigo` e a chave da tabela), único parcial em `cnpj` e em `cpf` (quando preenchidos), único em `codigo_cliente_omie` (quando preenchido) e um índice único antigo em `cnpj` (`clientes_cnpj_key`). Como o `codigo` é único e **nulo não colide**, os 90 cadastros sem código não violam nada.
- **`fornecedores`** (82 linhas; 0 inativos; 3 com CNPJ; categorias marcadas: Fornecedor 77, Agente de Carga 9, Transportador 3, Prestador IMS 3, e nenhum fornecedor sem categoria): `id`, `codigo`, `razao_social`, `nome_fantasia`, `tipo_pessoa`, `cnpj`, `cpf`, `categorias` (lista de texto), `email`, `telefone`, `contato`, os 6 `endereco_*`, `observacoes`, `ativo`, `criado_por` (texto), `criado_em`, `atualizado_em`. Índices: único em `codigo`, únicos parciais de `cnpj` e `cpf` (e dois índices únicos antigos equivalentes) e GIN em `categorias`.
- **`fornecedores_avaliacoes`** (0 linhas): `id`, `fornecedor_id` (FK `RESTRICT`), `nota` (CHECK 1–5), `comentario`, `avaliado_por`, `avaliado_em`.
- **Colunas de outras tabelas que apontam para estes cadastros:** `pi_importacao.fornecedor_id`, `embarques_importacao.agente_carga_id` e `empresa_desembaraco_id`, `leads.cliente_id`, `propostas.cliente_id`, `quadros_comando.cliente_id`, `dossier_obra.cliente_id`, `formularios_elevador.cliente_id`, `contratos_sociais.cliente_id`.
- **Funções SQL:** `gerar_codigo_cliente` (sequência `seq_clientes_codigo`), `gerar_codigo_fornecedor` (sequência `seq_fornecedores_codigo`), `cadastro_vinculos`, `cadastro_bloquear_exclusao`. **Edge Function:** `omie-buscar-cliente`. **APIs externas:** BrasilAPI (CNPJ e CEP) e ViaCEP.

### PC-9 Navegação, cache e testes
- **Padrões gerais** (navegar por `setSubsel` + `setRoute`, estado na URL, cache-busting `?v=`, mapa de rotas, testes e CI): `01_geral.md` PC-9. **Específico daqui:** `cadastros.jsx` depende de `pi.jsx` (componentes `PI*`) e de `ordenar-tabela.js` (`useOrdenacao`) já carregados; o cartão NPS depende de `cotacoes-varejo-store.js`. Mexeu em `cadastros.jsx`, nas duas stores ou em `enderecos-api.js`? Suba o `?v=` no `index.html`; **`enderecos-api.js` também é carregado por `formulario-cliente.html`** (que usa `?v=4`, enquanto o `index.html` usa `?v=5` — conferir os dois ao mexer).
- Rota nova de Cadastros entra no teste de fumaça sozinha (`KNOWN_ROUTES`). As rotas aqui usam `useRotaId` (segundo segmento) e `useRotaItem` (terceiro, só em Clientes).

### PC-10 Menu "?" e tutoriais
- O mecanismo do "?" e a regra "tutorial não se edita à mão" estão em `01_geral.md` PC-10. **Aqui só o estado do módulo (Conferido em `shell.jsx` e `TreinamentoVP/`):** há texto de ajuda (`HELP_TOPICS`) para `cadastro-clientes` e `cadastro-fornecedores`; o do cliente termina com "Exclua com cuidado." e **nenhum dos dois cita Inativar, a regra de nunca excluir com transação, o documento único nem o NPS**. Há tutorial para as duas telas (`TreinamentoVP/cadastros-mestres/clientes` e `/fornecedores`; o último commit da pasta `cadastros-mestres` é de 30/10/2026, mas o conteúdo das duas telas não foi reconferido contra a tela de hoje) e um "?" do módulo ("Cadastros Mestres" → pasta `cadastros-mestres`).
- **Estado: desatualizados.** As telas mudaram em 31/10/2026 (lixeira com Inativar, busca com pontuação, aviso de "não encontrado", cartão "Lista incompleta", documento único). Regerar pela sessão de tutoriais; **não** editar o HTML à mão.
- A pasta `cadastros-mestres` também guarda os tutoriais de Matérias-Primas e Produtos, que **hoje são telas de Fabricação** (módulo 13): ver PC-11.

### PC-11 Documentos soltos e destino do que foi concatenado
*"Concatenar" = reunir num só documento o que estava espalhado (Art. 50).* **Reunido neste documento:**
- **O próprio `03_cadastros_mestres.md` anterior** (seções 1 a 17: mapeamento de 31/10/2026, "Placa-Mãe", regras do Gelson e as tarefas T1 a T8): reescrito nos temas das telas e na Parte comum; continua no Git. O passo a passo SDD das tarefas T1–T8 (Specify, Clarify, Plan, Tasks) virou decisões em PC-5, 3.2.8, 3.2.10 e 3.x.11.
- **Do `CLAUDE.md`** (continua lá só o que é lei ou o que é de outro módulo): as seções mistas **"Consulta de CNPJ 'Omie primeiro' — Clientes, Fornecedores, Formulário e Leads"** e **"CPF/CNPJ de verdade + comissão manual do lead"** (a parte de Clientes e Fornecedores está em PC-3 e PC-4; a de Leads já estava em `02_crm.md`), o item **"Razões sociais repetidas em `clientes`"** da "Auditoria #843" (PC-5) e o item 15 da "Auditoria de amarrações" (Histórico do cliente por lead e cotação, 3.1.6 e 3.1.10). Cada uma ganhou uma nota "→ parte já migrada para Cadastros Mestres"; **nada foi apagado**.
- **Fica no `CLAUDE.md` por ser lei:** Art. 16 e a seção "🔒 ÁREA BLINDADA — Cadastros Mestres".
- **De outro módulo (apontado, não copiado):** o item 18 da "Auditoria de amarrações" (conversão de cotação da planilha histórica em Formulário: PF/PJ do documento) é do Formulário (módulo 4); as cotações de varejo e o NPS são do módulo 7 (aqui só a leitura do NPS).
- **Só histórico, ficam onde estão:** `AUDITORIA_FORENSE_E2E_SCORE.md` (raiz, 19/10/2026) cita as duas telas apenas como "já investigadas"; `docs/seguranca/cascata-assinatura.md` cita `criarOuVincularDeLead` como um passo da cascata da assinatura (módulo 14 e `01_geral.md` PC-3); `docs/CONTEXTO_workflow_setores_vpclick.md` não trata destes cadastros (as menções são de outro assunto); `README.md` da raiz descreve o produto.
- **Tutoriais** (`TreinamentoVP/cadastros-mestres/*`): pertencem à sessão de tutoriais (PC-10). Os de `materias-primas` e `produtos` ficam sob esta pasta embora as telas sejam do módulo 13: **a decidir** com a sessão de tutoriais.
- **Candidatos a obsoletos para o Gelson decidir:** nenhum arquivo solto sobre Cadastros foi achado para descarte. Os arquivos não versionados de `docs/` (planos de Separação) e de `TreinamentoVP/` não são deste módulo e não foram tocados.
- Nenhum outro arquivo sobre Clientes ou Fornecedores foi encontrado na raiz, em `docs/`, `docs/superpowers/specs/`, `docs/superpowers/plans/`, `docs/seguranca/`, `docs/revisoes/` nem em `handoffs/` (busca por "cadastros mestres", "cadastro-clientes", "cadastro-fornecedores", nomes das stores, `VPCLI`, `VPFOR` e `cadastro_vinculos`).

### PC-12 Benefícios trocados com os outros módulos
*(Regra do Gelson, 31/10/2026, Art. 49: o que um módulo tem de bom e novo passa para os outros.)*
- **Recebido do Geral (`01_geral.md`) e aplicado aqui:** os 11 temas por tela, o selo de verificação, o glossário próprio, a Parte comum, "achado, sem correção", a contagem de testes rodados de verdade e os padrões de PC-9: leitura paginada com cartão de erro (já existia), hooks antes do `return` (**Conferido**: respeitado em `cadastros.jsx`).
- **Recebido do CRM (`02_crm.md`) e aplicado aqui:** a regra da **data pura `aaaa-mm-dd`** (gerou o achado 3.1.10, item 4: a frase do Score) e a de **atualizar uma linha sem recarregar** (gerou o item 6); as colunas do Omie em `clientes` são gravadas pela tela de Leads (`gravarOmieNoCliente`, `02_crm.md` PC-4): encontrado grava data e código do Omie; não encontrado grava a data vazia e marca como verificado; **falha de consulta (`null`) não grava nada**. Quem mexer nessas colunas aqui deve respeitar essas três regras.
- **Duas implementações da mesma regra (a corrigir quando o Gelson decidir):** a consulta "Omie primeiro" existe em `enderecos-api.js` (`consultarCnpjOmieFirst`, usada por Clientes, Fornecedores e Formulário) e em `comercial.jsx` (`buscarClienteOmie`, usada por Leads). **Não feito:** unificar.
- **Recebido de Comercial | Pré-venda (31/10/2026, `01_geral.md` PC-9):** gatilho de identidade no banco (achado 3.2.10, item 11), trava com destrave por motivo e o cuidado com lista cortada. Nenhuma mudança de código.
- **Recebido de Financeiro & Preços (31/10/2026, texto em `05_financeiro_precos.md` PC-5):** o cadastro do cliente guarda **Contribuinte de ICMS**, que decide se há DIFAL na Precificação; sem ele, a Precificação devolve a cotação ao Vendas. O valor "não respondido" e "Não" continuam indistinguíveis em clientes antigos (spec de 15/10/2026).
- **Recebido de Engenharia & Produto (01/11/2026, texto em `08_engenharia_produto.md` PC-12):** (1) comparar o payload dos stores com `information_schema.columns`; (2) conferir se as ações Criar/Editar/Excluir declaradas no catálogo de alçadas são **lidas** pela tela (na Ficha Técnica só uma de cinco é); (3) a Ficha Técnica apaga produto do catálogo com `DELETE` físico — o mesmo cuidado da área blindada de exclusão. **Não verificado** aqui.
- **Recebido de Obras & Instalação (01/11/2026, texto em `09_obras_instalacao.md` PC-12):** em 01/11/2026, **50 de 68** Dossiês de obra não têm `cliente_id`; o nome do cliente no Dossiê é texto livre vindo da planilha e o vínculo é manual (campo na Visão Geral, 9.1). A "Vida do Cliente" (3.1) só acha obra de quem tem o vínculo, e `listarEquipamentosDoCliente` casa por **nome**. **Conferido** no banco e no código.
- **Recebido de Entrega & Documentação (01/11/2026, texto em `10_entrega_documentacao.md` PC-12):** nada específico de Cadastros; vale o bloco do `01_geral.md`. A Central de Documentos (10.1) lê as tabelas `parceiros_*` (empresas instaladoras, colaboradores e documentos de RH), que **não** são deste módulo.
- **Recebido de Parceiros & Instaladores (01/11/2026, texto em `11_parceiros_instaladores.md` PC-12):** empresa instaladora e colaborador **não** são deste módulo (11.1), mas são cadastros de terceiros com CPF, RG, CNH e dados bancários e com **exclusão física**; o Art. 16 (cadastro com transação não se exclui) não os cobre. Estender a regra é decisão do Gelson (11.1.10). **Conferido** no código e no banco, 01/11/2026.
- **Recebido de Logística Interna (01/11/2026, texto em `12_logistica_interna.md` PC-12):** nada específico de Cadastros Mestres; vale o bloco do `01_geral.md`. Matérias-Primas e Produtos moram hoje no grupo Fabricação (13).
- **Recebido de Fabricação (01/11/2026, texto em `13_fabricacao.md` PC-12):** Matérias-Primas e Produtos (agora 13.5 e 13.6) são listas **somente leitura** do Omie, com a regra única de matéria-prima `VPMP%`; não decidir por tipo SPED. **Conferido** no código, 01/11/2026.
- **Recebido de Suprimentos & Importação (31/10/2026, texto em `07_suprimentos_importacao.md` PC-12):** (1) o **Catálogo Siscomex** exclui produto e, junto, as **fichas técnicas** vinculadas (`DELETE` em cadeia, policy aberta ao público): é o mesmo tipo de risco que a área blindada de exclusão de cliente/fornecedor evita; vale procurar `delete()` em cadeia nos cadastros (**Conferido** no catálogo; **Não verificado** aqui). (2) Existem **duas avaliações de fornecedor** (`fornecedor_avaliacoes`, NPS 0–5 das Cotações de Varejo, e `fornecedores_avaliacoes`, nota única do cadastro) ainda não unificadas — decisão do Gelson, afeta 3.2.
- **Recebido de Contratos & Jurídico (31/10/2026, texto em `06_contratos_juridico.md` PC-12):** o nome da alçada tem de ser o mesmo no catálogo, na tela e na política do banco. A exclusão de cliente e fornecedor tem trava própria no banco (gatilhos); **Não verificado** se as demais políticas de `clientes` e `fornecedores` usam o nome certo. Sem mudança de código.
- **Doado ao Geral e ao CRM (texto completo em `01_geral.md` PC-9; o CRM aponta):**
  - **Gravar com conferência prévia de duplicidade, índice único parcial e mensagem clara:** a store confere o documento antes de gravar (para dizer **qual** cadastro já usa), o banco reforça com índice único parcial (para valer com dois cadastros ao mesmo tempo ou fora da tela) e o erro `23505` do índice vira a mesma mensagem; falha ao conferir = não grava; na criação a conferência roda antes de gerar o código.
  - **Código humano pela sequência do banco, sem reserva fixa:** nunca "maior código + 1" no navegador nem um código constante quando o banco falha; falha vira erro claro. Para o CRM: o `id` do lead (`LD-` + 6 dígitos do relógio, gerado no navegador) é do tipo que a regra desencoraja; ver `02_crm.md` 2.1.10.
  - **Link para registro que não existe:** mostrar aviso com "Voltar à lista" em vez de abrir a tela como se fosse "Novo".
- **Doado a Cadastros por outros módulos e ainda sem aplicação (pendência de código, não feita aqui):** atualizar só a linha depois de salvar; olhar o erro nas consultas do Histórico (3.1.10 itens 3 e 6).

---
*Documento reescrito em 31/10/2026 no molde de `01_geral.md` e `02_crm.md`. Aprovado como REAL pelo Gelson em 31/10/2026.*
