# Módulo Cadastros Mestres — Clientes e Fornecedores (especificação técnica)

> Mapeamento read-only de 31/10/2026, feito a partir de `src/cadastros.jsx`, `src/cadastros-clientes-store.js`, `src/cadastros-fornecedores-store.js` e `src/enderecos-api.js`, mais conferência pontual de `shell.jsx`, `router.js`, `app.jsx` e `colaboradores-admin-store.js` para rotas/alçadas, e de `grep` dos consumidores. Nenhum código foi alterado. Tudo que não está visível no código está marcado como **"não confirmado"**.
>
> Escopo: apenas as duas telas **Clientes** e **Fornecedores**. As telas vizinhas do mesmo grupo de menu (Matérias-Primas, Produtos, Instaladores, Custos, Catálogo Siscomex) não fazem parte deste documento.

> **Leitura obrigatória (atualizado em 31/10/2026):** as seções 2 a 8 descrevem o mapeamento **de antes** das correções T1–T8. Onde uma frase delas ficou superada, está marcada com **[SUPERADO → §N]**; o estado atual está nas seções 10 a 14. Em caso de dúvida, vale a seção mais nova.

## 1. Visão geral e propósito

Cadastros Mestres é a base corporativa única de **pessoas jurídicas/físicas** que o resto do sistema referencia. Comercial, Importação, Engenharia, Jurídico e Logística leem as mesmas tabelas `clientes` e `fornecedores`, em vez de manter cadastros próprios (`cadastros.jsx`, cabeçalho: "Módulo transversal").

- **Clientes** — tabela `clientes`. Alimentada de três formas: digitação manual nesta tela, criação automática pelo Formulário de Elevador (quando alguém informa CNPJ/razão social) e conversão de Lead em Cliente (CRM). Código humano `VPCLI-0001…`.
- **Fornecedores** — tabela `fornecedores`. Cadastro **único** com `categorias[]` (Fornecedor, Agente de Carga, Transportador, Prestador IMS) em vez de um cadastro por tipo de prestador. Código humano `VPFOR-0001…`.
- **Consulta de CNPJ "Omie primeiro"** nos dois formulários, com fallback para consulta pública (BrasilAPI).

Menu: grupo "Cadastros" (`shell.jsx` linhas 38–39), com `MODULE_HOME["Cadastros"] = "cadastro-clientes"`. Na alocação de alçadas por grupo, `'Cadastros Mestres'` agrupa `cadastro-clientes`, `cadastro-fornecedores`, `cadastro-materias-primas` e `cadastro-produtos` (`colaboradores-admin-store.js:324`); os módulos de alçada são `cadastro-clientes` e `cadastro-fornecedores` (linhas 162–163).

## 2. Mapeamento de rotas e componentes

### 2.1 Roteamento

| Item | Valor | Fonte |
|---|---|---|
| id da rota Clientes | `cadastro-clientes` | `router.js:31` (`KNOWN_ROUTES`), `app.jsx:442` → `<window.CadastroClientesPage/>` |
| id da rota Fornecedores | `cadastro-fornecedores` | `router.js:31`, `app.jsx:443` → `<window.CadastroFornecedoresPage/>` |
| Rótulo no menu | "Clientes" / "Fornecedores" | `shell.jsx:38–39`, `BREADCRUMB_MAP` linhas 385–386 (módulo "Cadastros") |
| Caminho do tutorial | `cadastros-mestres/clientes`, `cadastros-mestres/fornecedores` | `shell.jsx:515–516` |

O prefixo de URL do primeiro segmento é o do grupo de menu (os comentários do próprio arquivo usam `/cadastros-mestres/cadastro-clientes…`; o texto das rotas em `CLAUDE.md` cita também `/cadastros/clientes`). **Não confirmado:** qual prefixo literal o roteador gera hoje na barra de endereços; o roteador usa só o 2º segmento para resolver a tela.

### 2.2 Estado refletido na URL (`window.useRotaId` / `window.useRotaItem`)

**Clientes** (`CadastroClientesPage`, `cadastros.jsx:154`):

| URL (após o id da rota) | Efeito |
|---|---|
| *(vazio)* | Lista |
| `/novo` | Abre o formulário de novo cliente |
| `/<id>` | Abre o formulário de edição daquele cliente |
| `/<id>/historico` | Abre o modal "Histórico · <razão social>" |

Lógica: `showForm = rotaId === 'novo' || (!!rotaId && sub !== 'historico')`; `editing` e `historicoDe` buscam o cliente em `items` pelo id da URL. Se o id da URL não existir na lista carregada, `editing` fica `null` e o formulário abre como "Novo" (comportamento derivado do código; não há mensagem de "não encontrado"). **[SUPERADO → §13: hoje aparece o aviso "não encontrado" com "Voltar à lista".]** Abrir/fechar usa `VpRouter.navigate('cadastro-clientes', …)`.

**Fornecedores** (`CadastroFornecedoresPage`, `cadastros.jsx:525`):

| URL | Efeito |
|---|---|
| *(vazio)* | Lista |
| `/novo` | Novo fornecedor |
| `/<id>` | Editar aquele fornecedor |

Não há modal de histórico em Fornecedores.

Ao abrir o formulário, a página rola até ele (`scrollIntoView`) — correção de 27/09 porque a lista tem 1200+ linhas. O formulário usa `key={editing ? editing.id : 'novo'}` para trocar de registro sem reaproveitar `useState`.

### 2.3 Componentes (`src/cadastros.jsx`)

| Componente / função | Papel |
|---|---|
| `CAD_UFS`, `cadFmtDoc` | Lista de 27 UFs; formata CNPJ (14 díg.) e CPF (11 díg.); outro tamanho devolve o valor cru; vazio devolve "—". |
| `CadEnderecoFields` | Bloco de endereço compartilhado: Logradouro, Complemento, Bairro, CEP, Cidade, Estado (select de UF). |
| `cadConsultarCnpj(form)` | Chama `EnderecoAPI.consultarCnpjOmieFirst` e monta um `patch` só com campos **vazios** do formulário. |
| `useCnpjOmieFirst(form, setForm)` | Hook do botão "Buscar CNPJ" e da consulta no salvar (`buscar`, `garantirConsulta`, `buscando`). |
| `ClienteForm` / `CadastroClientesPage` | Formulário e lista de clientes. |
| `ClienteHistoricoModal` / `calcularScoreRelacionamento` | Modal "Vida do Cliente". |
| `FornecedorForm` / `CadastroFornecedoresPage` | Formulário e lista de fornecedores. |
| `FornecedorAvaliacoes` | Avaliação simples (nota 1–5 + comentário), só ao editar. |
| `FornecedorNPS` | NPS das cotações de varejo (0–5, 6 critérios), só leitura, só ao editar. |
| `cadFmtEstrelas` | Média em estrelas arredondando para **baixo** (4,5 → 4 estrelas cheias) com o número exato ao lado. |

Dependências de UI usadas sem definição local: `PIField`, `PIInput`, `PISelect`, `Card`, `Button`, `Modal`, `StatusBadge`, `window.toast`, `window.useOrdenacao`, `window.NpsMini`, `window.CotacoesVarejoStore`.

## 3. Telas em detalhe

### 3.1 Clientes

**Cabeçalho:** eyebrow "Cadastros", título "Clientes", subtítulo "Cadastro central de clientes — inclui os criados automaticamente pelo Formulário." Botão **Novo cliente** (`abrirNovo`).

**Lista:** carregada por `CadastrosClientesStore.listarTodos()` (falha vira lista vazia). Enquanto `items === null` mostra "Carregando…".
- **Busca** (campo único, case-insensitive): razão social, nome fantasia, código, CNPJ ou CPF. A comparação de CNPJ/CPF é por `includes` no valor gravado (só dígitos), então digitar com pontuação não casa. **[SUPERADO → §13: `cadCasaDocumento` compara também os dígitos do termo.]**
- Contador "N cliente(s) encontrado(s)".
- **Colunas** (todas ordenáveis via `window.useOrdenacao`): Código, Razão social (com nome fantasia abaixo), CNPJ/CPF (formatado; badge amarelo "Doc. pendente" quando `documento_pendente`), Cidade/UF, Contato (`contato` ou `telefone`), Status (Ativo / badge "Inativo").
- **Ações por linha:** Histórico (ícone `history`), Editar (`edit`), Excluir (`trash`).
- Estado vazio: "Nenhum cliente encontrado."

**Formulário (`ClienteForm`)** — campos e estado inicial (`CLI_EMPTY`):

| Campo | Observação |
|---|---|
| Tipo de pessoa | select `PJ` (padrão) / `PF` |
| CNPJ ou CPF | o campo exibido/gravado depende do tipo; só PJ tem botão **Buscar CNPJ** |
| Inscrição estadual | texto livre |
| Razão social / Nome * | obrigatório |
| Nome fantasia, E-mail, Telefone, Contato | texto livre, sem máscara nem validação de formato |
| Contribuinte de ICMS? * | select Sim/Não; **obrigatório** (valor `boolean`, nulo bloqueia) |
| Documento pendente | checkbox (`documento_pendente`) |
| Endereço | 6 campos de `CadEnderecoFields` |
| Cliente ativo | checkbox (`ativo`, padrão marcado) |

Explicação na tela: *Contribuinte de ICMS* define quem paga o DIFAL nas vendas interestaduais — **não contribuinte** = a VerticalParts recolhe (custo na Precificação); **contribuinte** = o próprio cliente recolhe.

Botões: **Cancelar** (fecha e volta à lista) e **Cadastrar cliente / Salvar alterações** (desabilitado enquanto `saving`).

**Ordem de validação no salvar (`submit`):**
1. `garantirConsulta()` (CNPJ — ver 5.1); se devolver `false`, para.
2. Razão social vazia → toast "Informe a razão social / nome."
3. `contribuinte_icms` não booleano → toast pedindo Sim/Não.
4. `onSubmit(form)` → `atualizar` ou `criar` na store (que valida o documento de novo, ver 5.2).

**Exclusão (`excluir`) — [SUPERADO → §10: a lixeira agora mostra as transações e oferece Inativar; só cadastro sem vínculo é apagado]:** `window.confirm('Excluir o cliente "…"? Isso pode afetar formulários/propostas já vinculados.')` seguido de `CadastrosClientesStore.remover` (**DELETE físico**, ver 5.5).

**Modal "Histórico" (`ClienteHistoricoModal`, largura 640):** três blocos —
1. *Canal de entrada / Vendedor* — leads com `cliente_id` = cliente (data, origem, vendedor, prédio).
2. *Obras e equipamentos* — dossiês ligados ao cliente (nome da obra, status master, data de criação) e os montadores (união de `equipamentos_obra.parceiros_instaladores` e `dossier_obra_instaladores`). Texto vazio: "Nenhuma obra vinculada… vincule em Engenharia → Dossiê da Obra → Visão Geral."
3. *Score de relacionamento* — faixa em badge colorido, calculada **no navegador** por `calcularScoreRelacionamento` (não é nota numérica; comentário do código: não há dado financeiro/satisfação ligado ao cliente):
   - **Dormente** — maior data entre leads (`date`) e obras (`created_at`) anterior a 12 meses.
   - **Estratégico** — ≥ 3 obras ou ≥ 5 equipamentos.
   - **Recorrente** — ≥ 2 obras.
   - **Novo** — demais casos (inclui 1 obra ou só leads).
   A checagem de "Dormente" vem primeiro, então um cliente com muitas obras mas sem atividade há mais de 12 meses aparece como Dormente. Sem nenhuma data, `dormente` é falso.

### 3.2 Fornecedores

**Cabeçalho:** título "Fornecedores", subtítulo "Cadastro único — Fornecedor, Agente de Carga, Transportador e Prestador IMS, marcados por categoria." Botão **Novo fornecedor**.

**Lista:** `CadastrosFornecedoresStore.listarTodos()` + `mediasAvaliacoes()` (falhas viram vazio).
- **Busca:** razão social, nome fantasia, código, CNPJ ou CPF (mesma observação sobre pontuação).
- **Filtro de categoria:** select "Todas as categorias" + as 4 categorias (`CATEGORIAS`); filtra por `categorias.includes`.
- **Colunas** (ordenáveis): Código, Razão social (+ fantasia), Categorias (badges), CNPJ/CPF, Contato, Avaliação (estrelas + média; "—" sem avaliação), Status.
- **Ações por linha:** Editar, Excluir (**não há botão de histórico**).
- Excluir: `confirm('Excluir o fornecedor "…"?')` + `remover` (DELETE físico).

**Formulário (`FornecedorForm`)** — estado inicial `FOR_EMPTY`:

| Campo | Observação |
|---|---|
| Categorias * | 4 "pílulas" com checkbox escondido; pelo menos uma obrigatória |
| Tipo de pessoa | `PJ` / `PF` |
| CNPJ ou CPF | botão **Buscar CNPJ** só em PJ |
| Razão social / Nome * | obrigatório |
| Nome fantasia, E-mail, Telefone, Contato | livres |
| Endereço | 6 campos |
| Observações | textarea |
| Fornecedor ativo | checkbox |

Não existe campo de "Contribuinte de ICMS", "Inscrição estadual" nem "Documento pendente" em Fornecedores.

Ordem de validação no salvar: `garantirConsulta()` → razão social → ao menos uma categoria → `onSubmit`.

**Seções extras (só ao editar, abaixo do formulário):**
- `FornecedorAvaliacoes` — nota 1–5 (select), comentário opcional, botão **Avaliar**; lista histórico com lixeira por avaliação (confirmação "Remover esta avaliação?"). O autor gravado é `user.nome || user.email || null`. Remover é DELETE físico.
- `FornecedorNPS` — usa `CotacoesVarejoStore.avaliacoesDoFornecedor(id, nome)` e `NPS_CRITERIOS`; mostra `NpsMini` + as 8 últimas. **Somente leitura**: as notas nascem em Cotações de Varejo. Retorna `null` se `CotacoesVarejoStore` ou `NpsMini` não existirem. Convive com `fornecedores_avaliacoes` (nota única 1–5) sem unificação; no código apenas a segunda é editada aqui.

## 4. Matriz de herança e doação de dados

### 4.1 O que herda

| Origem | Como chega nos Cadastros | Evidência |
|---|---|---|
| **CRM / Leads** | Ao virar "Convertido" (edição do lead, Kanban, Proposta assinada, botão "Vincular agora" da Automação) chama `CadastrosClientesStore.criarOuVincularDeLead(lead)`. Idempotente por `leads.cliente_id`; sem vínculo, procura cliente por razão social (`ilike` exato, com `limit(1)` e curingas `%`/`_`/`\` escapados) e, se não achar, **cria** com `razao_social = lead.building || lead.contact`, `contato`, `telefone`, `email` e `contribuinte_icms`; depois grava `leads.cliente_id`. | `comercial.jsx:333–344, 746–748`, `crm.jsx:194–197`, `proposta-store.js:440`, store `:204–230` |
| **Formulário de Elevador** | Cria clientes "nos bastidores" ao preencher CNPJ/razão social e usa `gerarCodigo()` do store de clientes. | `formulario-elevador-store.js:287` (e comentário do cabeçalho da store) |
| **Omie** | Dados cadastrais via consulta de CNPJ (razão, fantasia, telefone, e-mail). Histórico de importação (191 → 1212 clientes) citado em comentário; o mecanismo da importação **não está neste módulo** (não confirmado). | `enderecos-api.js`, comentário `cadastros-clientes-store.js:42` |
| **Consulta pública** | BrasilAPI (CNPJ) e BrasilAPI/ViaCEP (CEP) para endereço e CNAEs. | `enderecos-api.js` |

Regras da conversão Lead → Cliente (store): quando o lead já tem `cliente_id`, o contribuinte de ICMS informado no lead só completa o cliente **se ainda for nulo** (`completarContribuinte`, nunca troca valor existente); `vincularQuadrosDoLead` aponta `quadros_comando.cliente_id` para o cliente apenas em quadros do lead que ainda não têm cliente (falha só loga no console). O lead não tem CNPJ, então a deduplicação por nome é "best-effort".

### 4.2 O que doa

**Clientes** (`CadastrosClientesStore`):

| Consumidor | Uso |
|---|---|
| Formulário de Elevador (`formulario-elevador.jsx:483, 490, 1454`) | `listarTodos` e `obter` para escolher/exibir o cliente do formulário |
| Propostas | `proposta-store.js:440` chama `criarOuVincularDeLead` ao assinar |
| Dossiê da Obra (`dossier-obra.jsx:526`) | lista para vincular o dossiê ao cliente |
| Contratos Social (`contratos-sociais.jsx:37`) | busca do cliente ao salvar o PDF |
| Contrato do Instalador (`contrato-instalador.jsx:363`) | `listarTodos` |
| Projeto de Elevadores (`projeto-elevador-store.js:150`) | resolve cliente por documento |
| Leads/CRM (`comercial.jsx`, `crm.jsx`) | conversão e vínculo |

Não aparece no `grep` do módulo, mas o `CLAUDE.md` descreve a herança de dados do cliente para Contrato de Venda; **não confirmado** nos arquivos deste escopo.

**Fornecedores** (`CadastrosFornecedoresStore`):

| Consumidor | Chamada |
|---|---|
| Formulário de Elevador / RFQ (`formulario-elevador.jsx:1183`) | `listarAtivos('Fornecedor')` — e-mail/telefone/contato do cadastro substituem um mapa antes hardcoded |
| P.I. (`pi.jsx:45`, datalist por categoria) | `listarAtivos(categoria)` |
| Cotação de frete / Embarques (`embarques-frete-cotacoes.jsx:70, 285`) | `listarAtivos('Agente de Carga')` (ou todos) |
| Cotações de Varejo (`cotacoes-varejo-store.js:124`) | `listarAtivos()` sem filtro |

PCP como consumidor direto da store **não foi encontrado** no `grep` de `src/` (não confirmado).

## 5. Regras de negócio e validações

### 5.1 Consulta de CNPJ "Omie primeiro" (`enderecos-api.js › consultarCnpjOmieFirst`)

1. CNPJ inválido (dígitos verificadores) → `{ fonte: null, erro: 'CNPJ inválido — confira os dígitos.' }` sem chamar nada.
2. Chama a Edge Function **`omie-buscar-cliente`** com `{ cnpj_cpf }` (o front nunca fala direto com o Omie). Estados: `encontrado: true` / `false` / `null` (falha de consulta, **nunca** tratar como "não cadastrado"). Mensagens de erro distinguem HTTP 401 ("sessão sem permissão…") e outros status.
3. Encontrado → `fonte: 'omie'`; só trazem razão social, fantasia, telefone e e-mail (endereço vem vazio; `status` ativo/inativo pelo flag `inativo`).
4. Não encontrado **ou** falha → tenta `buscarCNPJ` (BrasilAPI v1, timeout 5 s): 404 = "CNPJ não encontrado."; demais falhas = "Serviço… temporariamente indisponível." Sucesso → `fonte: 'externo'` com endereço completo, situação cadastral e CNAEs.
5. Função nunca lança.

**No formulário (`cadConsultarCnpj` + `useCnpjOmieFirst`):**
- O `patch` só inclui campos **vazios** do formulário (razão, fantasia, telefone, e-mail e os 6 de endereço) — nunca sobrescreve digitado.
- **Botão "Buscar CNPJ"**: exige CNPJ válido (senão toast "Informe um CNPJ válido para buscar."); toast verde indica a fonte ("CNPJ já cadastrado no ERP Omie…" ou "…não está no Omie — dados trazidos da consulta pública.").
- **Consulta no salvar (`garantirConsulta`)**: pula se PF, se "documento pendente" (somente em clientes) ou se não há dígitos. Com dígitos: CNPJ inválido bloqueia (toast "CNPJ inválido… (ou marque 'documento pendente')"); se o CNPJ atual já foi consultado (`consultadoRef`) segue; senão consulta e, **se trouxe dado novo, para** com o toast "Dados preenchidos… clique em salvar de novo"; se não trouxe nada novo, ou a consulta falhou (só aviso, "Confira os dados manualmente"), **deixa salvar**.
- Observação: em Fornecedores `form.documento_pendente` não existe no estado, então a condição nunca é verdadeira ali; CNPJ inválido sempre bloqueia o salvar.
- A consulta é uma só por CNPJ por abertura de formulário; editar o CNPJ para outro valor dispara nova consulta no próximo salvar.

### 5.2 Validação algorítmica de CPF/CNPJ

`enderecos-api.js`: `cpfConfere` (11 dígitos, recusa sequência repetida, 2 dígitos verificadores) e `cnpjConfere` (14 dígitos, recusa repetidos, pesos oficiais). `validarDocumento(tipo, valor)`:
- vazio → `{ ok: true, digitos: '' }` (aceito; quem chama decide se é obrigatório);
- tamanho diferente do esperado para o tipo → mensagem que cita o tamanho e sugere "parece um CNPJ/CPF… Troque o tipo…";
- dígitos verificadores errados → "CPF/CNPJ inválido — os dígitos verificadores não conferem."

As duas stores (`_payload`) chamam `validarDocumento` **antes** de gravar e lançam o erro (o formulário mostra `Erro: …`). O campo gravado é determinado pelo **tipo escolhido** (`cnpj` para PJ com `cpf = null`; `cpf` para PF com `cnpj = null`), eliminando o bug antigo de `form.cnpj || form.cpf`. Se `window.EnderecoAPI` não estiver carregado, a store aceita só os dígitos (sem validação).

Comentário do código registra que, em produção (04/10/2026), todos os CPF/CNPJ existentes eram válidos antes do endurecimento (informação do `CLAUDE.md`; não revalidada aqui).

### 5.3 Segregação por categoria (Fornecedores)

`CATEGORIAS = ['Fornecedor', 'Agente de Carga', 'Transportador', 'Prestador IMS']`; `categorias` é um array e um fornecedor pode ter várias. `criar` exige ao menos uma (também na tela). `listarAtivos(categoria)` filtra `ativo = true` e, se informada, `contains('categorias', [categoria])`, ordenado por razão social, devolvendo `id, codigo, razao_social, nome_fantasia, categorias, email, telefone, contato`.

### 5.4 Códigos humanos

- **Clientes:** `gerarCodigo()` chama a RPC `gerar_codigo_cliente` (sequência `seq_clientes_codigo` no Postgres, evita corrida). **Falha da RPC ou resposta vazia lança erro explícito**; o código antigo caía em `'VPCLI-0001'`, que colidia com um cliente real (histórico em comentário, 21/09). O código só é gerado na criação (não muda na edição).
- **Fornecedores [SUPERADO → §11 (T3): hoje usa a RPC `gerar_codigo_fornecedor`, atômica, sem fallback fixo]:** `gerarCodigo()` lê `select('codigo')` de **todos** os fornecedores no navegador, pega o maior número e soma 1 (`VPFOR-NNNN`). Corrigido de `count(*)` porque a exclusão causava reutilização de código. **Risco residual (derivado do código):** não é atômico — dois cadastros simultâneos podem gerar o mesmo código e o índice único barrar o segundo; e sem `sb()` devolve `'VPFOR-0001'` (o mesmo anti-padrão corrigido em clientes). Sem tratamento de erro da leitura (`data` nula vira 0).

### 5.5 Preservação e integridade (soft-delete × exclusão)

**[SUPERADO → §10: `remover` agora confere `cadastro_vinculos` e recusa com transação ou falha ao conferir; há trava `BEFORE DELETE` no banco e `inativar`.] Texto original:** **Este módulo NÃO usa soft-delete.** `remover` nas duas stores executa `DELETE` físico em `clientes`/`fornecedores`. A única forma "suave" de retirar um registro de circulação é o flag **`ativo`** (checkbox "Cliente ativo"/"Fornecedor ativo"): `listarAtivos` só devolve ativos; `listarTodos` devolve todos e a lista mostra "Inativo".

- A confirmação do cliente avisa "pode afetar formulários/propostas já vinculados". **Não confirmado** no código desta tela: se há FKs `ON DELETE` que bloqueiem a exclusão de cliente referenciado (o `CLAUDE.md` descreve FKs em outras tabelas, mas não para `clientes`). O erro do banco, se vier, é exibido como `Erro: <mensagem>`.
- Exclusão de avaliação (`fornecedores_avaliacoes`) também é DELETE físico.
- Registros de log: toda criação/edição/exclusão chama `VPLog.registrar` (módulo "Cadastros": *Criou/Editou/Excluiu cliente*, *Criou/Editou/Excluiu fornecedor*, *Avaliou fornecedor*, *Removeu avaliação de fornecedor*) se `window.VPLog` existir. A exclusão de cliente registra só o id (sem nome).
- `criado_em`/`atualizado_em`: `atualizar` grava `atualizado_em`; `criar` de fornecedor grava `criado_por` com o e-mail de `window.__VP_USER`; em clientes `criado_por` **não** é gravado (coluna é uuid de `auth.users`, comentário no código).

### 5.6 Leitura e paginação

- `CadastrosClientesStore.listarTodos` pagina de 1000 em 1000 por `range` até a página vir incompleta (corrige o limite padrão do PostgREST; 14/09). Em erro devolve **o que já acumulou** (pode ser parcial) e faz `console.warn`.
- **[SUPERADO → §11 (T4): leitura de 1000 em 1000 com `listarTodosDetalhado` e cartão "Lista incompleta".]** `CadastrosFornecedoresStore.listarTodos` faz um único `select('*')` **sem `range`**: limitado ao teto padrão de 1000 linhas do PostgREST (a base atual de fornecedores não é conhecida; **não confirmado** se já passa disso). O mesmo vale para a leitura de `gerarCodigo` e de `mediasAvaliacoes` (esta última soma todas as avaliações no navegador).
- Ambos devolvem lista vazia se o Supabase não carregou; a tela não diferencia "erro" de "vazio".

### 5.7 Outras regras

- `Contribuinte de ICMS` é obrigatório na tela e gravado como `true/false/null` (`null` só vem de cadastros criados por outras origens, como Lead sem a resposta).
- Cliente com `documento_pendente` mostra o selo "Doc. pendente"; a flag nasce em Leads/Formulário (cliente sem CNPJ/CPF ainda) e aqui pode ser vista e limpa (correção de 14/09).
- O campo composto `endereco` (texto) de `clientes` é montado por `formatarEndereco` a partir das partes, e `cidade`/`estado` duplicam `endereco_cidade`/`endereco_estado` (compatibilidade com consumidores antigos). Fornecedores não têm esses campos compostos.
- Ordenação por coluna (`useOrdenacao`, 23/10): sem valor vai ao fim (regra do helper; não revalidada aqui).
- E-mail/telefone/CEP **não têm validação de formato** em nenhuma das telas.
- A tela não aplica filtro por vendedor/dono nem alçada por registro; o controle é a alçada do módulo (`cadastro-clientes`, `cadastro-fornecedores`) e o `CLAUDE.md` registra que a segurança real de dados depende da issue #571 (não verificado aqui).

## 6. Mapeamento de tabelas do Supabase

Colunas abaixo são **as que o código lê/grava**; o schema real (tipos, constraints, FKs, RLS) **não foi inspecionado** nesta etapa e deve ser conferido no banco antes de qualquer mudança estrutural.

### 6.1 `clientes`

| Coluna | Origem no código |
|---|---|
| `id` (uuid), `codigo` (`VPCLI-NNNN`) | `criar` / RPC `gerar_codigo_cliente` |
| `razao_social`, `nome_fantasia` | payload |
| `tipo_pessoa` (`PJ`/`PF`), `cnpj`, `cpf` (só dígitos, um deles nulo) | payload |
| `inscricao_estadual`, `contribuinte_icms` (boolean/null) | payload |
| `documento_pendente` (boolean) | payload |
| `email`, `telefone`, `contato` | payload |
| `endereco_logradouro`, `endereco_complemento`, `endereco_bairro`, `endereco_cep`, `endereco_cidade`, `endereco_estado` | payload |
| `endereco` (texto composto), `cidade`, `estado` | derivados do payload |
| `ativo`, `criado_em`, `atualizado_em` | payload / default |
| `omie_cadastrado_desde`, `omie_verificado_em`, `codigo_cliente_omie` | citadas no `CLAUDE.md` (migration `20260926170000_clientes_omie_cadastrado_desde.sql`); **não usadas nesta tela** |
| `criado_por` (uuid) | existe na tabela; **não gravada** por esta store |

Vínculos lidos pelo histórico: `leads.cliente_id`, `formularios_elevador.cliente_id` (para obter `numero_cotacao`), `dossier_obra` (por `cliente_id`, `lead_id` ou `numero_cotacao`), `equipamentos_obra` e `dossier_obra_instaladores` (com `parceiros_instaladores(nome)`). Escrita de vínculo: `leads.cliente_id`, `quadros_comando.cliente_id`.

### 6.2 `fornecedores`

`id`, `codigo` (`VPFOR-NNNN`), `razao_social`, `nome_fantasia`, `tipo_pessoa`, `cnpj`, `cpf`, `categorias` (array de texto), `email`, `telefone`, `contato`, os 6 `endereco_*`, `observacoes`, `ativo`, `criado_em`, `atualizado_em`, `criado_por` (e-mail). Não há `inscricao_estadual`, `contribuinte_icms` nem `documento_pendente`.

### 6.3 `fornecedores_avaliacoes`

`id`, `fornecedor_id`, `nota` (1–5), `comentario`, `avaliado_por`, `avaliado_em`. Média e contagem agregadas no navegador (`mediasAvaliacoes`).

### 6.4 Outras peças

- RPC `gerar_codigo_cliente` (sequência `seq_clientes_codigo`).
- Edge Function `omie-buscar-cliente` (projeto `jxtqwzmpgofwctqajewt`).
- APIs externas: BrasilAPI (`/api/cnpj/v1`, `/api/cep/v2`) e ViaCEP (fallback de CEP). A busca de CEP existe em `EnderecoAPI.buscarCEP`, mas **os formulários de Clientes/Fornecedores deste módulo não a chamam** (o campo CEP é digitação livre; não confirmado em outros pontos).
- NPS: tabela/consulta mantida por `CotacoesVarejoStore.avaliacoesDoFornecedor` (view `fornecedor_nps_v`, segundo o `CLAUDE.md`; não inspecionada aqui).
- Auditoria: `vp_logs` via `VPLog.registrar`.

## 7. Pontos de atenção e lacunas

**Situação atual de cada item (31/10/2026):** 1 resolvido (§10); 2 resolvido (§11 T3); 3 resolvido (§11 T4); 4 resolvido (§11 T4, cartão "Lista incompleta"); 5 em aberto (decisão de produto); 6 em aberto; 7 resolvido (§13); 8 parcial (§13: desempate por e-mail/telefone/ativo); 9 em aberto; 10 vale sempre (tutorial desatualizado pelas mudanças de §10–§14). A lista abaixo é o texto original do mapeamento.

1. **Exclusão física** em clientes/fornecedores/avaliações; comportamento diante de FKs **não confirmado**.
2. **Código de fornecedor não atômico** e com fallback fixo `VPFOR-0001` (clientes já tiveram esse bug corrigido).
3. **Fornecedores sem paginação** (limite de 1000 linhas do PostgREST) em `listarTodos`, `gerarCodigo` e `mediasAvaliacoes`.
4. `listarTodos` de clientes devolve resultado **parcial em silêncio** quando uma página falha.
5. Fornecedor não tem "documento pendente"; CNPJ inválido de fornecedor sempre bloqueia o cadastro.
6. Duas avaliações de fornecedor coexistem (nota única 1–5 editável aqui × NPS 0–5 de cotações, só leitura).
7. Busca por CNPJ/CPF não ignora pontuação.
8. Dedup Lead→Cliente é só por razão social exata (sem CNPJ no lead); homônimos reaproveitam o primeiro encontrado.
9. Sem validação de e-mail/telefone/CEP e sem autopreenchimento por CEP nesta tela.
10. Tutoriais (`cadastros-mestres/clientes` e `fornecedores`) e os textos de ajuda do `shell.jsx` (linhas 478–479) descrevem o comportamento atual; qualquer mudança nestas telas exige regenerar o tutorial pela sessão de tutoriais.

## 8. Diagnóstico "Placa-Mãe" (fios, trilhas e componentes) — 31/10/2026

> **Estado após T1–T8:** os fios rompidos/em curto de código e banco listados em 8.3 (exclusão física, código VPFOR, paginação, resultado parcial, dedup por nome, busca com pontuação, id inexistente na URL, ausência de unicidade de CNPJ/CPF) foram tratados nas seções 10–13. O vínculo de P.I./Embarque por texto foi tratado na §14 (coluna `fornecedor_id`, sem carga retroativa). Seguem em aberto: RFQ de peças (`rfq.jsx`) com id gerado em vez do cadastro, PCP sem ligação com `fornecedores` e o isolamento real de dados (#571). Texto original abaixo.

Varredura read-only. Fontes citadas: `docs/MAPA_DE_ROTAS.md` (linhas 49–50: rotas `/cadastros/cadastro-clientes` e `/cadastros/cadastro-fornecedores`; linha 194) e o código. **`sobresite.md` não existe no repositório** (busca em todo o projeto); nenhuma afirmação abaixo depende dele. Estado geral: **com fios rompidos** (sem curto confirmado em produção).

### 8.1 Componentes
- **Entradas (Omie/BrasilAPI, `enderecos-api.js`)** — protegidas: `consultarCnpjOmieFirst` nunca lança, timeout de 5 s na BrasilAPI, `encontrado: null` distinto de "não cadastrado", preenchimento só de campos vazios. Risco: o Omie não devolve endereço; falha de consulta deixa salvar (decisão deliberada). CEP existe em `buscarCEP`, mas os formulários não o chamam.
- **Entradas (Lead→Cliente, Formulário)** — `criarOuVincularDeLead` (store clientes `:204`) é idempotente; dedup só por razão social exata. Formulário usa `buscarOuCriarCliente` (`formulario-elevador-store.js:254`), que acha cliente por CNPJ/CPF e **devolve o existente sem atualizar dados** (só completa `contribuinte_icms` nulo).
- **Diodos (CPF/CNPJ)** — `validarDocumento` é chamado no `_payload` das duas stores e em `buscarOuCriarCliente`: gravação de documento inválido/trocado é barrada. Vazio é aceito de propósito. Lacuna: não há checagem de **duplicidade** de CNPJ/CPF em `clientes` na tela nem em `fornecedores` (nenhuma migration de `unique` para essas colunas foi encontrada em `supabase/migrations`).
- **Triacs (categorias)** — chaveamento correto via `listarAtivos(categoria)` (`contains`) em P.I., Embarques e RFQ; `listarAtivos()` sem filtro em Cotações de Varejo. Isolamento só no front.

### 8.2 Trilhas de doação

| Destino | Origem | Status | Observação |
| :--- | :--- | :--- | :--- |
| Comercial (Formulário/Proposta) | `clientes.id` (`formularios_elevador.cliente_id`) | Íntegra | Proposta assinada → `criarOuVincularDeLead` (`proposta-store.js:421–440`) |
| Jurídico (Contrato Social) | `clientes` | Íntegra | `contratos_sociais.cliente_id`, busca em `listarTodos` |
| Jurídico (Contrato Venda/Instalador) | `clientes` | Parcial | Instalador lê `listarTodos` (`contrato-instalador.jsx:363`); herança de dados do cliente no Contrato de Venda **não confirmada** neste escopo |
| Suprimentos (RFQ de peças `rfq.jsx`) | `fornecedores` | **Rompida** | `addFornecedor` grava `fornecedor_id: store.novoId()` (id novo, não o do cadastro) + nome digitado (`rfq.jsx:28–38`) |
| Cotação de elevador (Formulário/RFQ) | `fornecedores` | Íntegra por nome | `listarAtivos('Fornecedor')` (`formulario-elevador.jsx:1183`); casamento por aproximação de nome |
| Importação (P.I., Embarque) | `fornecedores` | Parcial | `CadFornecedorDatalist` (`pi.jsx:41`) grava só **texto** (`agente_carga` no embarque, `embarques-importacao-store.js:96`); sem FK |
| Frete (cotações) | `fornecedores` "Agente de Carga" | Íntegra | `embarques-frete-cotacoes.jsx:70,285`, guarda `fornecedor_id` |
| PCP / Fabricação | `fornecedores` | **Rompida (inexistente)** | Nenhum arquivo de PCP/Almoxarifado lê `fornecedores`; PCP usa `pcp_produto_fornecedor` (tabela própria, `20261002130000`) |
| Pagamentos a Instaladores | `fornecedores` | Não aplicável | Instaladores usam `parceiros_instaladores`, não `fornecedores` (não há leitura de `fornecedores` nesses arquivos) |

### 8.3 Fios rompidos e curtos
- **[Fio rompido]** `rfq.jsx:28–38`: fornecedor da RFQ identificado por id gerado + nome livre; renomear/desativar no cadastro não se reflete.
- **[Fio rompido]** P.I./Embarque (`pi.jsx:41–52`, `embarques-importacao-store.js:96`): vínculo por texto; mudança de nome no cadastro quebra a correspondência.
- **[Fio rompido]** PCP × `fornecedores`: sem ligação (duas bases de fornecedor).
- **[Fio rompido]** `cadastros-fornecedores-store.js:19–27`: código `VPFOR` calculado no navegador, não atômico, com fallback fixo `VPFOR-0001`.
- **[Fio rompido]** `cadastros-fornecedores-store.js:29–34,143–155`: sem paginação (teto de 1000 linhas do PostgREST) em `listarTodos`, `gerarCodigo` e `mediasAvaliacoes`.
- **[Fio em curto]** `cadastros-clientes-store.js:170–177` / `cadastros.jsx:197–201`: DELETE físico de cliente; FKs (`leads`, `formularios_elevador`, `dossier_obra`, `contratos_sociais`) **não verificadas** — a trava de integridade relacional exigida deve ser conferida no banco (nesta etapa não inspecionado). Preferir `ativo = false`.
- **[Fio em curto]** `cadastros-clientes-store.js:47–58`: `listarTodos` devolve resultado parcial em silêncio se uma página falhar.
- **[Fio em curto]** `cadastros-clientes-store.js:216`: dedup Lead→Cliente por razão social exata; homônimos reaproveitam o primeiro.
- **[Fio em curto]** `cadastros.jsx:205–209`: busca por CNPJ/CPF não ignora pontuação.
- **Estado/F5:** abrir/editar/histórico refletem a URL (`useRotaId`/`useRotaItem`); id inexistente na URL abre formulário "Novo" sem aviso (`cadastros.jsx:173`).

## 9. Regras do Gelson (31/10/2026)

- **Cliente/fornecedor com transação nunca é excluído** — pode ser editado; `id` e o código `VPCLI`/`VPFOR` ("ID-Tag") ficam sempre os mesmos; para tirar de circulação, inativar. Registrado como Área Blindada no `CLAUDE.md`. Implementação: issue #1221 (hoje `remover` ainda faz DELETE físico sem conferir vínculos — ver 5.5 e 8.3).
- **Onde ficam os passos do método:** Specify, Clarify, Plan, Tasks e Analyze deste módulo (inclusive T5 #1225 e T6 #1226) são escritos **neste documento**, nunca no `CLAUDE.md`, que é a Constituição (blindada desde o cabeçalho).

## 10. T1 (#1221) — nunca excluir cadastro com transação: Specify e levantamento no banco (31/10/2026)

**Specify.** Regra blindada: cliente/fornecedor com transação pode ser editado (o `id` e o código VPCLI/VPFOR não mudam) e nunca é excluído; tirar de circulação = `ativo = false`. Exclusão física só sem nenhum vínculo, conferido antes; falha ao conferir = não apaga.

**Levantamento (só leitura, projeto `jxtqwzmpgofwctqajewt`).**

FKs que apontam para os cadastros (`pg_constraint`):

| Tabela → alvo | Coluna | ON DELETE | Efeito de apagar hoje |
| :--- | :--- | :--- | :--- |
| `leads` → `clientes` | `cliente_id` | NO ACTION | banco recusa (protegido) |
| `formularios_elevador` → `clientes` | `cliente_id` | NO ACTION | banco recusa |
| `dossier_obra` → `clientes` | `cliente_id` | NO ACTION | banco recusa |
| `contratos_sociais` → `clientes` | `cliente_id` | NO ACTION | banco recusa |
| `propostas` → `clientes` | `cliente_id` | **SET NULL** | **apaga em silêncio o vínculo da proposta** |
| `quadros_comando` → `clientes` | `cliente_id` | **SET NULL** | **apaga em silêncio o vínculo do pedido de quadro** |
| `fornecedores_avaliacoes` → `fornecedores` | `fornecedor_id` | **CASCADE** | **apaga junto o histórico de avaliações** |

Vínculos **sem FK** (o banco não protege nada):
- Clientes: `projetos_elevador_desenhos.cliente_id`, `propostas_vigentes.cliente_id`; `pcp_pedidos.codigo_cliente` (código do Omie, casa com `clientes.codigo_cliente_omie` — 12 clientes com pedido).
- Fornecedores: `iv_cotacao_convites.fornecedor_id` (8 fornecedores), `embarques_importacao.cotacoes_frete[].fornecedor_id` (7, jsonb); por **nome** em `pi_importacao.fornecedor`, `embarques_importacao.agente_carga`/`empresa_desembaraco`, `cotacoes_elevador_fornecedor.fornecedor`, `formularios_elevador_unidades.fornecedor`, `pcp_expedicoes.transportadora` (14 fornecedores casam por nome); jsonb `ims_importacao.fornecedores`, `rfq_importacao.fornecedores` (ids próprios, ver T5), `pedidos_fornecedor.fornecedor`.

Políticas: `clientes` tem `ALL` liberado para `anon` e `authenticated`; `fornecedores` e `fornecedores_avaliacoes` têm DELETE liberado para `public`. **Qualquer pessoa com a chave pública consegue apagar** (segurança real = #571).

Números: 1.239 clientes (134 com vínculo por id; 1.050 com código do Omie; 1 inativo); 82 fornecedores (nenhum inativo; 0 avaliações em `fornecedores_avaliacoes` e 0 no NPS hoje).

**Plan proposto (aguarda Clarify do Gelson — ver perguntas abaixo).**
1. Store: `vinculos(id)` conta todas as fontes acima; `remover` recusa com qualquer vínculo ou erro de leitura.
2. Tela: a lixeira abre um aviso com a lista de vínculos e o botão **Inativar**; sem vínculo, pede confirmação e apaga.
3. Banco (migration, só com CONFIRMO): trocar `propostas`/`quadros_comando` de SET NULL e `fornecedores_avaliacoes` de CASCADE para `RESTRICT`; gatilho `BEFORE DELETE` em `clientes` e `fornecedores` conferindo também os vínculos sem FK, para valer mesmo fora da tela.
4. Testes unitários da regra + `?v=` bumpado.

**Perguntas (Clarify).**
- (a) Cliente que **veio do Omie** (tem `codigo_cliente_omie`) conta como "com transação" mesmo sem vínculo no site?
- (b) Fornecedor citado **só por nome** (P.I., embarque, cotação) conta como transação?
- (c) Aplicar a trava também no banco (passo 3), além da tela?

**Clarify — respostas do Gelson (31/10/2026).** (a) Cliente vindo do Omie conta como transação. (b) Fornecedor citado só pelo nome conta como transação — principalmente se houve troca de e-mails, o que também trava a saída. (c) Travar também no banco.

**Implementação (branch `claude/confident-einstein-nqzyq4`).**
- Banco: migration `20261031120000_cadastros_nunca_excluir_com_transacao.sql` — função `cadastro_vinculos(tipo, id)` (fonte única das transações, inclui Omie, nome aproximado e e-mails em `emails_projeto`, para clientes e fornecedores), gatilho `BEFORE DELETE` em `clientes` e `fornecedores`, e FKs `propostas`/`quadros_comando`/`fornecedores_avaliacoes` trocadas para `RESTRICT`. **Aplicada só com o "CONFIRMO" do Gelson.**
- Stores: `vinculos(id)` e `inativar(id)`; `remover` recusa com transação ou falha ao conferir (sem a função no banco, nenhuma exclusão passa).
- Tela: a lixeira mostra as transações e oferece Inativar; sem transação, pede confirmação e exclui.
- Testes: `src/cadastros-nunca-excluir.test.js` (8).
- **Migration aplicada em produção em 31/10/2026** (com o "Confirmo" do Gelson). Conferido no banco: os 2 gatilhos existem; as 3 FKs estão em `RESTRICT`; `cadastro_vinculos` é executável pela tela e a função da trava não é. Exemplos: AKAI (Formulário 1, cadastrado no Omie, 5 e-mails), Glarie (11 P.I., 37 cotações, 85 unidades, 63 e-mails). Hoje **99 de 1.239 clientes** e **59 de 82 fornecedores** não têm nenhuma transação (só esses podem ser excluídos). A tentativa real de DELETE barrada pela trava **não foi testada** (exigiria comando destrutivo no banco).

## 11. T4 (#1224) e T3 (#1223) — leitura completa e código VPFOR do banco (31/10/2026)

**T4 — feito no código.** `listarTodosDetalhado()` nas duas stores devolve `{ itens, erro }`; Fornecedores passou a ler de 1000 em 1000 (lista e médias de avaliação), como Clientes já fazia. A tela mostra o cartão "Lista incompleta… Tentar de novo" quando a leitura falha no meio, em vez de exibir a lista parcial como inteira. `listarTodos()` continua devolvendo só a lista (contrato dos outros módulos). **`listarAtivos` não foi mexido de propósito** (é peça da Área Blindada do E-mail/RFQ; com 82 fornecedores está longe do teto de 1000).

**T3 — feito; migration aplicada em produção em 31/10/2026 com o "Confirmo" do Gelson (sequência em 82, o próximo é VPFOR-0083; só a função usa a sequência).** `gerarCodigo()` de Fornecedores chama a RPC `gerar_codigo_fornecedor` (sequência `seq_fornecedores_codigo`, começa depois do maior código existente, hoje VPFOR-0082) e falha com erro claro, sem o antigo `VPFOR-0001` fixo. Migration `20261031130000_gerar_codigo_fornecedor.sql`. **O código só pode ir para a `main` depois da migration aplicada**: sem a função no banco, ninguém consegue cadastrar fornecedor novo.

Testes: +5 em `src/cadastros-nunca-excluir.test.js` (1.005 linhas, falha no meio, média com 2 páginas, código do banco e falha sem chute). Suíte 886/886.

## 12. T2 (#1222) — o mesmo CNPJ/CPF não pode ter dois cadastros (31/10/2026)

**Medição no banco (só leitura):** **0** documentos repetidos. Clientes: 1.239 cadastros, 1.060 com CNPJ, 75 com CPF; fornecedores: 82 cadastros, só 3 com CNPJ. Todos gravados só com dígitos. Não há duplicata a limpar.

**Código (Clientes e Fornecedores):** antes de criar ou editar, a store confere se o CNPJ/CPF já existe em outro cadastro e recusa com o código e a razão social de quem já usa ("… já está cadastrado em VPCLI-0123 — Fulano (inativo: reative esse cadastro em vez de criar outro)"). Falha ao conferir = não grava. Documento vazio (pendente) não é conferido. Na criação a conferência roda antes de gerar o código, para não gastar número.

**Banco (aplicado em produção em 31/10/2026 com o "Confirmo" do Gelson; os 4 índices conferidos como únicos e válidos):** migration `20261031140000_cadastros_documento_unico.sql` — 4 índices únicos parciais (`cnpj`/`cpf` de `clientes` e `fornecedores`, só quando o documento está preenchido). Garante a regra mesmo com dois cadastros ao mesmo tempo ou gravação fora da tela; a recusa do índice (código `23505`) vira a mesma mensagem clara. **Cadastro inativo também conta.** O código pode ir para a `main` antes ou depois dos índices (a conferência da tela funciona sozinha).

Testes: +10 em `src/cadastros-nunca-excluir.test.js`.

## 13. T8 (#1228) — ajustes de robustez (31/10/2026)

- **Busca por CNPJ/CPF com pontuação:** digitar `12.345.678/0001-90` agora acha o cadastro (o banco grava só dígitos; a busca compara também os dígitos do termo, com 3+ dígitos). `cadCasaDocumento` em `cadastros.jsx`.
- **Link para cadastro inexistente** (`/cadastro-clientes/<id>` ou `/cadastro-fornecedores/<id>` de cadastro excluído ou link antigo): mostra o aviso amarelo "não encontrado" com "Voltar à lista", em vez de abrir o formulário como "Novo". Se a lista também estiver incompleta, o aviso diz isso.
- **Lead → Cliente com nome repetido:** `criarOuVincularDeLead` agora busca até 20 clientes com a mesma razão social e escolhe pelo **e-mail** do lead, depois pelos **8 últimos dígitos do telefone**, depois o **ativo**; sem desempate fica o primeiro, como antes, com aviso no console. Nunca cria um cliente a mais quando já existe o nome.
- **Contrato de Venda (investigação, só leitura):** o Contrato **não lê `clientes`**. Ele herda o comprador do snapshot da Proposta (`propostas.data_json.cliente`, em `aplicarProposta` de `contrato-venda.jsx`). Ou seja, editar o cadastro do cliente depois de a Proposta existir **não** muda o Contrato. Não foi alterado (seria decisão do Jurídico).
- Testes: +2 (desempate de homônimo). `cadastros.jsx` v17, `cadastros-clientes-store.js` v19.

## 14. T6 (#1226) — P.I. e Embarque guardam o id do fornecedor (31/10/2026)

Decisão do Gelson: **coluna nova** (não trocar o campo de texto).
- **Banco** (migration `20261031150000_fornecedor_id_pi_embarque.sql`): `pi_importacao.fornecedor_id`, `embarques_importacao.agente_carga_id` e `embarques_importacao.empresa_desembaraco_id` (uuid → `fornecedores(id)`, `on delete restrict`). Os campos de texto continuam existindo e sendo o que a tela mostra.
- `cadastro_vinculos` passa a contar a P.I./embarque pelo id **ou** pelo nome (o nome continua valendo para o histórico antigo).
- **Como o id é preenchido** (`CadastrosFornecedoresStore.resolverIdPorNome`): o nome digitado tem de bater exatamente (sem acento/maiúscula/espaços extras) com a razão social ou o nome fantasia de **um único** cadastro; dois cadastros com o mesmo nome ou nome parcial = sem id (nunca chuta). Vínculo anterior que ainda bate é mantido. Falha ao ler o cadastro = mantém o id que já havia.
- P.I. criada pelo lote de Cotações de Varejo herda o `fornecedor_id` do convite. No embarque, o agente de carga vem da cotação de frete vencedora quando há.
- **Limite:** P.I./embarques antigos ficam sem id até serem salvos de novo (não houve carga retroativa); a tela não mostra o vínculo.
