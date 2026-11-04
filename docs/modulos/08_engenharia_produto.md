# 8 Engenharia & Produto — documento do módulo (REAL, fonte da verdade — 01/11/2026)

> **Status: REAL (documento oficial do módulo 8), aprovado pelo Gelson em 01/11/2026**, no molde de `01_geral.md` a `07_suprimentos_importacao.md`. Histórico de entrega (PR, hash, `?v=`) não se repete aqui: o Git guarda.
>
> **Por que este módulo pede cuidado:** é onde nasce o **dado técnico do produto** (a Ficha Técnica, que cria o produto no Omie e alimenta o Catálogo Siscomex) e onde o **Projeto de Instalação** do cliente é guardado e **assinado** — essa assinatura é o terceiro aval que libera a compra na China. Três tabelas daqui estão abertas à chave pública (PC-6) e a exclusão de ficha é física.
>
> **Fonte da verdade:** o código e o banco, conferidos em 01/11/2026 (`origin/main` `4653a17`). **Conferido** = lido no código ou consultado no banco (só SELECT) nesta data; **Herdado** = veio do `CLAUDE.md`, de uma spec ou do documento de outro módulo e **não** foi reconferido; **Não verificado** = não consegui conferir (e o texto diz). Sem selo vale como Não verificado.
>
> **Escopo do módulo:** as **cinco** telas do grupo "Engenharia & Produto" do menu (`NAV_GROUPS` em `shell.jsx`): **Projeto de Elevadores**, **Projeto de Equipamento**, **Solicitações de Produto**, **Ficha Técnica** e **Linha do Tempo da Cotação**. Rotas sem item de menu que também são deste módulo (hub Engenharia, Kanban "Solicitações NCM") estão na PC-3. **Não são deste módulo:** o Catálogo Siscomex (7.8) e o funil de pré-venda que ele exibe (`ficha-workflow.jsx`, tema 7.8); a ART, o Dossiê, o Mapa de Obras e a Instalação em Campo (9); Central de Documentos, Data Book, Entrega Final e Repositório Documentos (10); o Almoxarifado e a Lista de fios (12); o PCP, o MES e as Matérias-Primas/Produtos de Cadastros (13 e 3); o assinador público `/assinar` e a regra do PDF assinado (6); o aval em si (5.3).
>
> **Onde moram arquivos que não têm nome óbvio (Conferido):** "Projeto de Elevadores" é `engenharia-elevador.jsx` (não `projeto-elevador.jsx`); "Projeto de Equipamento" é `engenharia-config.jsx`; a Ficha Técnica divide o trabalho entre `ficha-tecnica.jsx` (tela), `-engine.js` (categorias, SKU, regras), `-store.js` (banco), `-imagens.js` (fotos), `-copiloto.jsx` (IA de NCM) e `ficha-omie-publish.js` (Omie); o painel dos três avais exibido no 8.1 é `aval-engenharia.jsx`.

## Como esta numeração funciona
- A regra de numeração (móvel, como cláusula de contrato) e os 11 temas de cada tela moram **uma vez só**, em `docs/modulos/01_geral.md`. Aqui vale a mesma: módulo = **8**; telas filhas = **8.1 a 8.5**, na ordem do menu; o conteúdo comum fica na **Parte comum** (PC-), sem número de tela.
- **Tudo o que é janela, aba, gaveta ou assistente de uma tela pertence a ela.** No 8.1 estão as duas abas, a janela "Salvar documentos da obra", a janela de assinatura e o painel dos avais; no 8.3 a lista, o formulário, o detalhe e a janela de exclusão; no 8.4 o painel, o editor, a pré-visualização, o Copiloto NCM e a publicação no Omie.
- Mudou algo? Escreva no tema certo da tela e **reescreva o Índice e o Glossário** na mesma sessão.

## Índice
8. **Engenharia & Produto**
   8.1 Projeto de Elevadores (abas Desenhos e Especificação técnica; assinatura do Projeto de Instalação; painel dos avais) · 8.2 Projeto de Equipamento · 8.3 Solicitações de Produto · 8.4 Ficha Técnica · 8.5 Linha do Tempo da Cotação
   &nbsp;&nbsp;&nbsp;Cada tela tem os temas: x.1 O que é · x.2 Rota e arquivos · x.3 Perfil e acesso · x.4 O que a tela mostra · x.5 Botões e controles · x.6 Comportamento · x.7 Dados (lê/grava) · x.8 Regras e armadilhas · x.9 Testes · x.10 Pendências e decisões · x.11 Histórico
   Parte comum de Engenharia & Produto (sem número de tela)
   &nbsp;&nbsp;&nbsp;PC-1 Mapa de ligações · PC-2 Os dois fluxos de ponta a ponta · PC-3 Rotas e código sem item de menu · PC-4 Código do produto e SKU · PC-5 Da Ficha Técnica ao Omie · PC-6 Identidade, alçadas e segurança · PC-7 Gatilhos, eventos e funções · PC-8 Tabelas · PC-9 Navegação, cache e testes · PC-10 Menu "?" e tutoriais · PC-11 Documentos soltos e destino do que foi concatenado · PC-12 Benefícios trocados com os outros módulos
9. Obras & Instalação → `09_obras_instalacao.md` (REAL)

## Glossário (módulo Engenharia & Produto)
Termos gerais (alçada, soft-delete, alerta, Nº da cotação, evento de fluxo) estão em `01_geral.md`; **Aval Engenharia**, **Aval de Pagamento** e **Aval Jurídico** em `05_financeiro_precos.md` e `06_contratos_juridico.md`; **P.I.**, **Catálogo Siscomex** e **DUIMP** em `07_suprimentos_importacao.md`. Não se repetem aqui.
- **Projeto de Instalação:** o PDF de projeto da obra (poço, cabine, porta), assinado pelo representante do cliente; é o documento do 8.1 que vira o **Aval Engenharia**.
- **ID-TAG:** o PDF de identificação de cada equipamento, que mora junto do Projeto de Instalação; **não** precisa de assinatura.
- **Código do equipamento:** `VPEL-EL0955-1`, `-2`… — um por equipamento físico da cotação (numeração da Precificação, 5.2).
- **Desenho (aba):** uma linha por arquivo em `projetos_elevador_desenhos`. **Especificação técnica (aba):** o formulário antigo de unidades (`projetos_elevador`), hoje vazio.
- **Projeto de Equipamento:** a especificação de **escada e esteira rolante** (não de elevador) em `equipamentos_spec`.
- **Solicitação de Produto:** o "chamado" de quem não achou o produto; vira Ficha Técnica. Número `SOL-AAAAMMDD-NNNNN`.
- **Ficha Técnica:** o cadastro técnico do produto (identificação, categorias de campos, fotos, NCM/DUIMP). Número `VPFT…`. Cada ficha salva cria/atualiza uma linha em `catalogo_produtos`.
- **Biblioteca (da ficha):** categorias e campos criados por qualquer usuário (`fichas_lib_*`), oferecidos às fichas **novas**; ficha salva guarda o seu próprio retrato.
- **SKU automático:** código descritivo montado pela ficha (`VPEL-PP-TEL-AD-IN-800X2100-258`); **não** é o código do Omie.
- **Prefixo de código:** VPEL, VPER, VPB, VPMP — os quatro com geração automática do próximo número no Omie (PC-4).
- **Copiloto NCM:** a IA da ficha (na VPS) que propõe NCM, descrição DUIMP e preenche campos.
- **Linha do tempo:** a soma, em ordem, de tudo o que já aconteceu numa cotação; não grava nada.

---

## 8.1 Projeto de Elevadores

### 8.1.1 O que é
O repositório dos **documentos de cada obra de elevador**, por cotação: o **Projeto de Instalação** e o **ID-TAG** (um PDF por equipamento), com os códigos dos equipamentos, e o caminho para o cliente **assinar** o Projeto. Também carrega a aba antiga **Especificação técnica** (formulário de unidades, tabela `projetos_elevador`) e, no pé da aba Desenhos, o painel dos **três avais** da compra. **Conferido** em `engenharia-elevador.jsx` (763 linhas), `projeto-elevador-store.js` e `aval-engenharia.jsx`, 01/11/2026.

**Fora do escopo:** o assinador público `/assinar` e o PDF assinado (6 e PC-5 do 6); a regra dos três avais e o botão "Decidir comprar" (5.3, 4.3); a ART e o Dossiê (9); o envio dos documentos ao fornecedor (4.3 "Enviar documentos"); documento solto (10 Repositório Documentos).

### 8.1.2 Rota e arquivos
- Rota `eng-projeto-elevadores`; URL `/engenharia/eng-projeto-elevadores[/desenhos|/especificacao[/novo|/<id>]]`: a **aba** vai na URL (`useRouteTab`, padrão `desenhos` deixa a URL limpa) e, na Especificação, **novo/editar** também (`useRotaItem`). A janela "Salvar documentos da obra" e a de assinatura **não** vão na URL. **Conferido.**
- Arquivos: `src/engenharia-elevador.jsx` (`window.ProjetoElevadorPage`), `src/projeto-elevador-store.js` (`window.ProjetoElevadorStore`), `src/aval-engenharia.jsx` + `aval-engenharia-store.js` (painel dos avais), `src/projeto-assinado-pdf.js` (PDF assinado), `src/documento-signatarios-store.js` (assinatura).
- Bucket de arquivos: `engenharia` (público), pasta `projetos-elevador/desenhos/<cotação ou avulso>/<tipo>/…`.

### 8.1.3 Perfil e acesso
Sem `restrict`, rota fora de `RESTRICTED` e a tela **não chama `temCapacidade`**; a alçada `eng-projeto-elevadores` existe no catálogo (grupo "Engenharia") mas não é conferida. A busca pela cotação passa por `FormularioElevadorStore.obter`, que **aplica a regra de dono** (`formularios.ver_de_outros`): cotação de outro vendedor devolve o erro dessa regra. **Conferido.**

### 8.1.4 O que a tela mostra
Cabeçalho "ENGENHARIA · PROJETO DE ELEVADORES" / **Projeto de Elevadores**; duas abas.
- **Desenhos** (padrão): subtítulo "Repositório dos projetos e desenhos dos elevadores, por cotação, para enviar aos clientes…"; botões **Atualizar** e **Salvar documentos da obra**; caixa de busca ("prédio, cliente, CNPJ/CPF, cotação, equipamento ou arquivo"); tabela **Prédio / Cliente · Nº Cotação · Equipamento(s) · Documento · Arquivo · Tamanho · Salvo por · Data**. Na coluna Documento: selo do tipo (Projeto de Instalação / ID-TAG), aviso âmbar **"Falta ID-TAG"** ou **"Falta Projeto de Instalação"** (cada obra precisa dos dois) e o selo da assinatura (Link criado, Enviado, Visualizado, ✓ Assinado, Recusado, Expirado). No pé, o cartão dos avais por cotação (`AvalEngenhariaCard`: Nº, cliente, OK/Pendente, "x/y assinados", situação de cada projeto).
- **Especificação técnica:** quatro cartões (Projetos, Unidades, Rascunho, Finalizados) e a tabela Referência · Nº Cotação · Unidades · Anexos · Status; vazia ("Nenhum projeto de elevadores").
- **Janela "Salvar documentos da obra":** Nº da Cotação, CPF/CNPJ, cartão "Obra vinculada", Prédio\*, Cliente, **Equipamento(s)\*** (caixas marcadas com os códigos achados + campo "Adicionar"), campos de arquivo **Projeto de Instalação** (PDF, PNG, JPG, DWG, DXF) e **ID-TAG** (só PDF), Observação.
- **Janela de assinatura:** nome, e-mail e WhatsApp do representante; depois os botões do 8.1.5.

### 8.1.5 Botões e controles
- **Salvar documentos da obra** (obrigatórios: prédio, ≥ 1 equipamento, ≥ 1 arquivo; aviso se falta um dos dois documentos, mas **permite** salvar assim). Máx. 25 MB por arquivo; 1 linha por arquivo.
- Por linha: **Abrir**, **Copiar link** (URL pública; cai para `prompt` se o navegador bloqueia), **Assinatura** (só Projeto de Instalação em PDF), 🗑 **Excluir** (soft-delete; a janela avisa que links já enviados continuam abrindo).
- **Janela de assinatura:** **Criar link de assinatura**; **Enviar por e-mail** / **Reenviar** (pelo `send-email`; se falhar, abre o `mailto:` e **não** registra o envio), **WhatsApp** (abre `wa.me`), **Copiar link**, **Criar novo link** (só após recusa), **Baixar PDF assinado** (original + página "ASSINATURAS DIGITAIS").
- Especificação técnica: **Novo projeto de elevadores**, **Salvar rascunho**, **Finalizar projeto**, anexar arquivos, adicionar/remover unidade.

### 8.1.6 Comportamento
- **Preenchimento pela cotação:** digitar o Nº (espera 450 ms) busca o formulário e preenche prédio, cliente e CPF/CNPJ **só em campo vazio ou que veio da própria busca** (nunca sobrescreve o digitado) e sugere os códigos dos equipamentos; digitar CPF/CNPJ completo acha o cliente cadastrado e lista as **obras dele** num seletor. Os códigos vêm da Proposta (`data_json.ativos[].codigo`), da Precificação (`mo_lookup[].identificador`) e das Unidades do Formulário, sem repetir.
- **Salvar:** valida extensão e tamanho, sobe cada arquivo, insere a linha e, **se o insert falha, remove o arquivo recém-subido**. Na **primeira** vez que a cotação ganha desenho emite `PROJETO_ELEVADOR_CRIADO`; na primeira vez que ganha **Projeto de Instalação** emite `PROJETO_ELEVADOR_FINALIZADO` (logo após o insert, para o evento não se perder se um upload seguinte falhar). Grava `VPLog` ("Salvou desenho").
- **Assinatura:** cria uma linha em `documento_signatarios` (`documento_tipo = projeto_instalacao`, `documento_id` = id do desenho, papel "Representante do cliente"); só **um** signatário. Quando o cliente assina (ou recusa), o banco avisa a Engenharia (PC-7) e o selo da linha muda.
- **Avais:** o cartão no pé consulta o `AvalEngenhariaStore.status(Nº)`: **OK** quando **todos** os Projetos de Instalação da cotação (não excluídos) têm assinatura; cotação sem nenhum Projeto salvo **não está OK**.

### 8.1.7 Dados
- **Lê/grava:** `projetos_elevador_desenhos` (**4 linhas, 3 ativas**), `documento_signatarios` (tipo `projeto_instalacao`: **2 linhas**), `projetos_elevador` (**0**). **Lê:** `formularios_elevador`, `clientes`, `propostas`, `precificacoes_elevador`.
- **Eventos:** `PROJETO_ELEVADOR_CRIADO`, `PROJETO_ELEVADOR_FINALIZADO` (e, pelo banco, `PROJETO_INSTALACAO_ASSINADO`). Em `eventos_fluxo` há **1** de cada (05/10, 08/10 e 09/10/2026). **Conferido.**

### 8.1.8 Regras e armadilhas
- **O Projeto de Instalação assinado é o Aval Engenharia** (5 PC-3); **ID-TAG não assina**; **sem trava de envio** (diferente do Desenho de Instalação do Contrato de Venda, 6.1). **Herdado** (CLAUDE.md 05/10 e 08/10) e reconferido no código.
- **Não troque a aba Desenhos pela Especificação** sem checar os eventos: `PROJETO_ELEVADOR_CRIADO/FINALIZADO` saem das duas abas e os nós `PROJETO_CRIADO` e `PROJETO_ENVIADO` do motor dependem deles (PC-7).
- A URL do arquivo é **pública** (bucket público, sem login); "Excluir" só tira da lista, o arquivo fica no Storage. **Conferido.**
- **Achado, sem correção:** `listarTodas` (Especificação) e `carregarAssinaturas` engolem erro e mostram lista vazia/zero (Art. 9); `listarDesenhos` corta em 1.000 linhas (hoje 4). **Conferido** no código.
- **Achado, sem correção:** os dois arquivos da obra 955 mostram que o primeiro Projeto (Rev.2) foi **excluído** com o link de assinatura ainda "visualizado", e o Rev.3 foi assinado em 08/10; o aval só olha desenhos não excluídos. É o comportamento desejado, mas o link do Rev.2 continua abrindo para quem o tem. **Conferido** no banco.
- O PDF assinado usa a fonte Caveat e a página de assinaturas com IP (regra travada, 6). Fonte Latin-1 do `pdf-lib`: caractere fora disso vira "?". **Herdado.**
- A janela de assinatura envia o e-mail por `EmailEnvioHelper` com `referencia_tipo = projeto_instalacao`: e-mail de cliente não cadastrado pode dar 403 (allowlist) e abre o `mailto:`. **Herdado** (área blindada do Inbox, 1.5).

### 8.1.9 Testes
`projeto-elevador-desenhos-eventos.test.js` (eventos na primeira vez), `aval-financeiro-store.test.js` (regra dos três avais) e `assinar-publico-f1.test.js`. Nenhum teste da tela nem da busca pela cotação. `npm test`: **931 passaram, 0 falharam** (01/11/2026). e2e: **não rodei** (a rota entra no teste de fumaça do CI). **Cenários de aceitação:** *Dado* a cotação 955 com Projeto Rev.3 assinado e dois ID-TAG, *quando* abro a aba Desenhos, *então* vejo "✓ Assinado" na linha do Projeto e o cartão "Aval Engenharia OK" — **coberto em parte** pelo teste da regra, não da tela. *Dado* um Projeto sem ID-TAG, *quando* a lista carrega, *então* a linha diz "Falta ID-TAG" — **sem teste**.

### 8.1.10 Pendências e decisões
- A aba **Especificação técnica** tem **0 linhas** e nenhuma outra tela a lê: decidir se continua (os eventos saem também dela). **Decisão do Gelson.**
- Alertar projeto parado sem assinatura; envio do desenho por e-mail pelo sistema (hoje "Copiar link"); versionar/substituir desenho (hoje cada save é uma linha nova). **Herdado**, não feito.
- Tutorial e texto do "?" não existem (PC-10).

### 8.1.11 Histórico
Criado como formulário de unidades (Especificação) em agosto/2026; a aba Desenhos (repositório) entrou em 05/10/2026, com equipamentos e dois documentos por obra no mesmo dia; assinatura do Projeto em 05/10 e Aval Engenharia em 08/10/2026. **Herdado.**

---

## 8.2 Projeto de Equipamento

### 8.2.1 O que é
O **configurador de escada e esteira rolante**: o engenheiro escolhe tipo, ângulo, largura, velocidade etc., vê o desenho esquemático e a capacidade calculada, anexa desenhos e um PDF do projeto, e guarda a especificação para orientar a compra. **Elevador tem tela própria (8.1).** **Conferido** em `engenharia-config.jsx` (420 linhas), 01/11/2026.

**Fora do escopo:** o formulário comercial de escada/esteira (4.1); a Precificação (5.2); o Hub Engenharia que usa `project-gates.js` (PC-3).

### 8.2.2 Rota e arquivos
Rota `eng-configurador`; URL `/engenharia/eng-configurador[/novo|/<id>]` (a janela abre pela URL, `useRotaId`). Arquivo `src/engenharia-config.jsx` (`window.ConfiguradorPage`). Bucket `engenharia`, pasta `<EQ-xxxxxx>/…`. **Conferido.**

### 8.2.3 Perfil e acesso
Sem `restrict` e sem `temCapacidade`; alçada `eng-configurador` no catálogo, não conferida. **Conferido.**

### 8.2.4 O que a tela mostra
Cabeçalho "ENGENHARIA · PROJETO DE EQUIPAMENTO"; quatro cartões (Equipamentos, Escadas rolantes, Esteiras rolantes, Finalizados "prontos p/ compra"); filtros Todos/Escada/Esteira com contagem; tabela Referência · Tipo · Configuração · Capacidade · Anexos · Status. **Janela:** Prédio\*, Responsável, tipo (Escada rolante | Esteira rolante), esquema SVG (vista lateral), campos do tipo (Escada: aplicação, ambiente, ângulo 30/35°, desnível, largura do degrau 600/800/1000, velocidade 0,5/0,65/0,75, degraus em patamar, motorização, economia, balaustrada; Esteira: ambiente, inclinação, comprimento, largura da palheta, velocidade, tipo de superfície, motorização, economia), **"Resumo técnico calculado"**, bloco amarelo **"PDF do Projeto (Inglês + Chinês)"**, anexos e observações para Compras.

### 8.2.5 Botões e controles
**Novo projeto de equipamento**, **Cancelar**, **Salvar rascunho**, **Finalizar especificação**, **Carregar PDF** / **Remover PDF**, **Anexar arquivo** (pdf, png, jpg, dwg, dxf, xlsx), × em cada anexo.

### 8.2.6 Comportamento
`eqCompute` calcula ao vivo: velocidade máxima pela norma (escada ≤ 30° → 0,75 m/s, senão 0,50; esteira ≤ 6° → 0,75, senão 0,50) com alerta vermelho se excedida, capacidade teórica (3600 × v × coef.(largura) ÷ 0,4), degraus e projeção horizontal (escada), tempo de travessia e desnível (esteira). O resultado é gravado em `computed`. Não emite evento, não grava `VPLog`.

### 8.2.7 Dados
Lê/grava `equipamentos_spec` (**3 linhas**, todas de 30/05/2026, com nomes de exemplo). Gera id `EQ-` + 6 dígitos do relógio.

### 8.2.8 Regras e armadilhas
- **Achado grave, sem correção:** o `Salvar` envia as colunas `projeto_pdf_recebido` e `projeto_pdf`, que **não existem** em `equipamentos_spec` (colunas reais: `id, project_id, referencia, tipo, responsavel, status, params, computed, anexos, observacoes, created_at, updated_at`; nenhuma migration as cria). **Conferido** no banco e nas migrations. Pelo comportamento do PostgREST, o salvar deve falhar com erro de coluna desconhecida; **não testei gravando** (seria escrever em produção). As 3 linhas existentes são anteriores a esses campos.
- `project-gates.js` lê a mesma coluna inexistente (gate "PDF Projeto"), só usado pelo Hub Engenharia fora do menu (PC-3). **Conferido.**
- **Remover anexo ou PDF apaga o arquivo do Storage na hora**, antes de salvar: quem cancela a janela fica com o registro apontando para arquivo apagado. **Achado**, pelo código.
- A lista engole erro de leitura (`.then(({data}) …)`, zero silencioso, Art. 9); `project_id` nunca é preenchido. **Achados.**
- O texto "segundo gatilho crítico para iniciar a importação" descreve uma regra que hoje só vive no Hub fora do menu; nenhum gate de compra a usa. **Conferido** (o gate real são os três avais, 5 PC-3).

### 8.2.9 Testes
`project-gates.test.js` (só o gate, com tabela simulada). Nenhum da tela nem do `eqCompute`. e2e: **não rodei**. **Cenário (sem teste):** *Dado* escada a 35° e 0,75 m/s, *quando* a janela calcula, *então* aparece "Velocidade acima da norma".

### 8.2.10 Pendências e decisões
**Decisão do Gelson:** (1) a tela continua? Ela tem 3 linhas de exemplo, nenhum fluxo a lê e o Salvar provavelmente falha; (2) se continuar, criar as duas colunas (migration, exige "Confirmo") ou tirar os campos do código; (3) o PDF em inglês/chinês pertence a esta tela ou ao 8.1?

### 8.2.11 Histórico
Criada em 30/05/2026 como "Configurador de Equipamentos" (escada, esteira e elevador); elevador saiu para o 8.1; padrão Card/filtros em #772 e deep-link/F5/Voltar em #1173 (**Herdado**).

---

## 8.3 Solicitações de Produto

### 8.3.1 O que é
O **chamado** de quem não achou um produto no site: o Comercial (ou a Importação) descreve o que precisa, a Engenharia analisa e **converte em Ficha Técnica**. Lista com filtros, formulário "Nova solicitação" (campos do FO-612), detalhe, janela de exclusão. **Conferido** em `solicitacoes-produto.jsx` (1.194 linhas) e `solicitacoes-produto-store.js` (381), 01/11/2026.

**Fora do escopo:** NCM, dados fiscais e código do produto (preenchidos na Ficha, 8.4); o cadastro no Omie (8.4/PC-5); levar marca/modelo/unidade para a Ficha (a spec de 26/10 excluiu — ver 8.3.8).

### 8.3.2 Rota e arquivos
Rota `solicitacoes-produto`; URL `/engenharia/solicitacoes-produto[/<id>]` (o **detalhe** vai na URL; **Nova solicitação** e os **filtros** não). Arquivos `solicitacoes-produto.jsx` (`window.SolicitacoesProdutoPage`), `-store.js`. Bucket `engenharia`, pasta `solicitacoes/<tmp-xxxx ou id>/`. **Conferido.**

### 8.3.3 Perfil e acesso
Alçada `solicitacoes-produto` (**Criar** e **Excluir** conferidas; Ver/Editar **não**). Sem a alçada Criar o botão fica desabilitado com dica; ver e abrir o detalhe é livre. Administrador passa. **Conferido** (`temCapacidade` em `PropostaStore`).

### 8.3.4 O que a tela mostra
- **Lista:** cabeçalho "ENGENHARIA · SOLICITAÇÕES DE PRODUTO"; botão **+ NOVA SOLICITAÇÃO**; filtros Status e Tipo (Elevador, Escada Rolante, Esteira); contadores TOTAL e um por status (novo, em análise, aguardando desenho, pronto, convertido em ficha); tabela Solicitação · Tipo · Código · Cliente · Solicitante · Status · Data · Ações (**ABRIR**, 🗑 com a alçada). **Embaixo de cada linha, um indicador de etapas** (03/11/2026): Recebido → Engenharia → Importação → Cadastro; verde = feito (✓ no Cadastro), amarelo = a próxima etapa, cinza = depois dela, tracejado = sem permissão para ler os registros. Engenharia = ficha criada; Importação = Importação avisada; Cadastro = publicada no Omie (regra em `SolProdTimeline.etapasDoCiclo`, lida de `solicitacao_produto_eventos`). **Conferido** no localhost (onde os eventos não são legíveis e as duas últimas etapas saem tracejadas); o estado real só se vê em produção.
- **Nova:** seções "Cabeçalho do produto" (Tipo de cadastro: *Peças e equipamentos* | *Insumo, consumo, matéria-prima ou ativo*; Tipo de equipamento\*; **Código** opcional por prefixo; **O que você precisa?\***; descrição comercial, referência, marca, modelo/part number, unidade, família sugerida), "Aplicação do produto" (função, material), "Referências e contatos" (site de referência, contato do fornecedor, observações, nº de série/ID TAG), "Dados complementares" (local de compra, lead time, característica, part number, cor, aplicação), "Fotos do produto" (3 slots: principal, laterais, verso + outras imagens/PDF), caixa **"Foi um pedido de um cliente específico?"** que revela Cliente, Indústria, WhatsApp e outro contato, e "Validação comercial" (solicitante, e-mail, sugestão de estoque mínimo e justificativa).
- **Detalhe:** "INFORMAÇÕES COMERCIAIS", "DESCRIÇÃO INICIAL", anexos e, fora do status `novo`, "ANÁLISE DE ENGENHARIA" (engenheiro, início, complementos, desenho).

### 8.3.5 Botões e controles
Lista: **+ Nova solicitação**, filtros, **Abrir**, **Excluir**. Nova: **Cancelar** e enviar. Detalhe por status: `novo` → **INICIAR ANÁLISE**; `em_analise` → **EDITAR ANÁLISE** (campos "Complementos descobertos" e "URL do desenho") → **SALVAR E MARCAR COMO PRONTO**; `pronto` → **CONVERTER EM FICHA TÉCNICA**; `convertido_em_ficha` → **ABRIR FICHA TÉCNICA**; **← VOLTAR**. A janela de exclusão exige a caixa "Estou ciente e tenho certeza…" antes de liberar "SIM, EXCLUIR".

### 8.3.6 Comportamento
- **Só uma coisa é obrigatória:** "O que você precisa?". O Tipo tem valor padrão (Elevador) e o Código é opcional. Cliente só é gravado se a caixa de pedido de cliente está marcada (senão os três campos vão a `null`, mesmo digitados). Campos só de peças (referência, marca, série) são descartados em insumo.
- **Criar** gera `SOL-AAAAMMDD-NNNNN` (5 dígitos sorteados), grava, `VPLog` e **avisa por WhatsApp UMA pessoa da Engenharia, escolhida por quem abre a solicitação** no campo obrigatório "Avisar por WhatsApp" (**Gelson Simoes, Alexandre Schmidt, Vinicius Leite ou Brayan Souza**, este com `automacao@verticalparts.com.br`; linha em `alertas`, módulo Engenharia). Antes (30/10) eram três pessoas fixas no código. O **título do aviso leva um resumo do pedido** (não o nº da solicitação): o gi-avisos apaga os números ao agrupar (S2.5) e duas solicitações no mesmo dia teriam o mesmo título. **Conferido** no código (03/11/2026); o envio real **não** foi testado.
- **Converter em Ficha:** cria a ficha com nome (`tipo — cliente`), descrição comercial (= "O que você precisa?"), categoria (= tipo de equipamento), descrição técnica (complementos + especificações levantadas) e **copia a 1ª imagem anexada para Foto** e o desenho para Desenho; depois marca `convertido_em_ficha`. **Converter não avisa mais ninguém:** quem termina a ficha, **na própria edição da Ficha Técnica**, escolhe no menu "Avisar Importação…" **uma** pessoa (**Andreia Oliveira, Beatriz Anderson ou Bianca Mayumi**) para conferir o NCM e publicar no Omie (o menu só aparece em ficha que veio de solicitação e ainda não foi publicada; `SolicitacoesProdutoStore.avisarImportacao`). Contato do fornecedor, link do produto e dados do cliente **não** são copiados (a descrição técnica é pública na ficha).
- **Excluir:** soft-delete (`excluido_em`/`excluido_por`), `VPLog`; a lista filtra `excluido_em is null`.
- **Copiloto VP** conhece a tela pelo texto da tabela `vp_copiloto_docs` (id `rota:solicitacoes-produto`), que vale mais que o `ROUTE_DOCS` embutido.

- **Linha do tempo real (03/11/2026):** no detalhe, a seção "LINHA DO TEMPO" lista, em ordem, quem abriu, **quem foi avisado e quem escolheu**, quem iniciou a análise, quem criou a ficha, quem foi avisado na Importação e quem publicou no Omie (inclui republicações). "Avisado" e "executou" são pessoas diferentes de propósito (o solicitante escolhe Brayan, mas Alexandre pode criar a ficha). Cada linha vem de `solicitacao_produto_eventos`, gravada no momento do fato com **o usuário logado como autor** (o banco confere `ator_email = vp_email()`); as 3 solicitações antigas são **reconstruídas** dos dados existentes e marcadas "(reconstruído)"; os avisos antigos eram automáticos (sem escolha de ninguém) e aparecem como "avisado(a) automaticamente (regra antiga)", nunca como "escolhido por". Aviso que não saiu aparece como "NÃO saiu". **Conferido** no código; a tabela só existe depois da migration `20261103120000` (aplicar com "Confirmo").

### 8.3.7 Dados
Lê/grava `solicitacoes_produto` (**9 linhas, 3 ativas**, todas `convertido_em_ficha`: 2 elevador, 1 escada rolante; 6 excluídas), `alertas` (9 linhas `sol-…`), **`solicitacao_produto_eventos`** (nova: imutável, nasce fechada — só usuário ativo lê e insere, sem update/delete), `fichas_tecnicas`/`catalogo_produtos` via `FTStore`. Lê, para a lista de prefixos, `importacao_varejo_produtos` e `pcp_produtos` (paginado). Índice **único** em `numero_solicitacao`. **Conferido.**

### 8.3.8 Regras e armadilhas
- **Achado, sem correção — filtro atrasado:** `onFiltroStatusChange` faz `setFiltroStatus(s); _carregarLista()`, e a função lê o valor **antigo** do estado: a lista aplica o filtro da escolha anterior. Os contadores saem da lista já filtrada. **Conferido** no código; não reproduzi no navegador.
- **Achado, sem correção — Voltar não volta:** o efeito de `solicitacaoId` carrega a lista quando o id some da URL, mas **não** troca `view` para `lista`; o botão Voltar do navegador pode deixar o detalhe antigo na tela. **Conferido** no código; não reproduzi.
- **Achado:** `DetalheView` chama `useState` **depois** de um `return` antecipado (viola as regras de hooks); funciona hoje, é frágil. **Conferido.**
- **Achado:** nada na tela grava `especificacoes_completas` (o estado existe, não há campo), mas a conversão a lê; o status `aguardando_desenho` existe na lista e **nenhum botão** o usa. **Conferido.**
- **Achado:** `dados_cadastro` (marca, modelo, unidade, família, part number, série, local de compra…) aparece no detalhe, mas **não vai para a Ficha** na conversão; a Ficha nasce sem marca/modelo/unidade, que o Omie usa (PC-5). A spec de 26/10 deixou isso fora do escopo. **Conferido.**
- **Achado:** na conversão, a ficha é criada **antes** de a solicitação ser marcada; se o segundo passo falha, fica ficha sem vínculo e um novo clique cria **outra**. **Conferido.**
- **Divergência código × spec (Art. 12):** a spec de 26/10 diz "obrigatórios: Tipo, Categoria (SKU) e O que você precisa?", mas a rodada 2 da mesma spec torna o Código **opcional** e o código só exige a descrição. Vale o código; **perguntar** se a spec deve ser corrigida.
- `listar` e `obter` engolem o erro e devolvem lista vazia/`null` (zero silencioso). As duas listas de quem pode ser avisado (Engenharia e Importação) ficam em `solicitacoes-produto-timeline-calc.js` (`window.SolProdTimeline`); trocar alguém é editar essa lista. As palavras "teste", "claude" ou "excluir" no título do aviso fazem o gi-avisos **não enviar** (S2.5): o título usa o início do texto de "O que você precisa?".
- As políticas (PC-6) deixam `authenticated` fazer **tudo**, inclusive apagar; a exclusão "soft" é só convenção da tela.

### 8.3.9 Testes
Regras puras da linha do tempo e das listas de avisados: `solicitacoes-produto-timeline-calc.test.js` (11 testes, incluindo o indicador de etapas). Sem teste de unidade do store nem da tela. e2e: **não rodei**. **Cenário de aceitação (sem teste):** *Dado* uma solicitação `pronto`, *quando* clico em Converter, *então* nasce uma ficha com a foto copiada, a solicitação vira `convertido_em_ficha` e a linha do tempo registra quem criou a ficha (ninguém é avisado nesse passo). *Dado* uma ficha vinda de solicitação, *quando* a pessoa escolhe "Beatriz Anderson" em "Avisar Importação…", *então* sai o aviso para ela e a linha do tempo registra a escolha.

### 8.3.10 Pendências e decisões
Corrigir o filtro e o Voltar; criar o campo de especificações ou tirá-lo; levar `dados_cadastro` à Ficha; geração de código para outros prefixos (VPIN, VPCON…) exige mexer em `proximo-codigo-produto` (outro projeto) — **decisão do Gelson**. Migrations do FO-612 (`20261026110000`, `…120000`, `…130000`): as colunas `tipo_cadastro` e `dados_cadastro` **existem** no banco (**Conferido**); a lista de tarefas da spec ainda as marca "aguardando CONFIRMO" — **desatualizada**.

#### Em especificação (04/11/2026) — Chat interno e devolução entre Solicitação, Engenharia e Importação
*Pedido do Gelson, em 04/11/2026. Passos do método (Art. 37) neste documento (Art. 38). **Nada foi implementado.** Selo: **Conferido** = visto no código em 04/11/2026; **Decisão do Gelson** = resposta dele neste dia; **Suposição** = minha, rotulada, a confirmar.*

**Specify — objetivo.** Hoje o ciclo é só para a frente: Solicitação → Ficha → aviso à Importação → publicação no Omie. Quando a Engenharia não tem subsídio para criar a Ficha, ou a Importação encontra problema antes de publicar, o assunto se resolve fora do sistema. Passa a existir um **chat interno por solicitação** e uma **devolução com pendência** que marca de quem é a vez e conta prazo. Os fios condutores continuam sendo **Solicitação → Ficha Técnica**: NCM, SKU, código, marca e demais dados do produto **moram só na Ficha (8.4)**; a tela de Solicitações não ganha formulário de cadastro. **Decisão do Gelson.**

*Requisitos*
- **FR01** Cada solicitação tem um chat (texto + anexos) visível a quem vê a solicitação; as mensagens ficam em ordem, com nome, departamento e hora. Conversa livre entre Solicitante, Engenharia e Importação.
- **FR02** **1ª volta, obrigatória ao Solicitante:** a Engenharia, sem subsídio para criar a Ficha, devolve ao solicitante com motivo e perguntas. **Só o solicitante daquela solicitação** (ex.: o vendedor que a abriu) responde. Respondida, segue de onde parou.
- **FR03** **2ª volta, da Importação para a Engenharia:** achado de problema depois da conversão em Ficha e antes de publicar. A mensagem pode citar um nome, mas **qualquer pessoa habilitada da Engenharia** responde.
- **FR04** A Engenharia pode, do mesmo modo, devolver à Importação citando um nome (ex.: Andreia): **qualquer pessoa da Importação** responde.
- **FR05** "Habilitado" = as pessoas dos departamentos como já documentado em 8.3.6 (`SolProdTimeline.ENGENHARIA` e `IMPORTACAO`). Administrador passa, como no resto do site (**Decisão do Gelson**, 04/11/2026).
- **FR06** Toda devolução abre uma **pendência**: a solicitação ganha a marca "Devolvida à Engenharia/ao Solicitante/à Importação — pendente de resposta", visível na lista e no detalhe, com **SLA de 4 horas**. A resposta encerra a pendência e registra na linha do tempo. **Decisão do Gelson** (a marca e as 4 h); o prazo conta **só em horário comercial, das 09 às 17 h de Brasília, seg–sex** (**Decisão do Gelson**, 04/11/2026; feriados que contam no SLA descontados é **Suposição**, mesma tabela `calendario_feriados` do `01_geral.md` 1.4.6). Atenção: a janela é **diferente** da Precificação (08–18 h).
- **FR07** Cada mensagem pode ser enviada **também por WhatsApp** a quem foi citado ou ao departamento (o autor marca). Pelo canal que já existe (`alertas` → gi-avisos). **Decisão do Gelson.**
- **FR08** A linha do tempo (8.3.6) registra devolução, resposta e quem respondeu; "avisado" e "quem respondeu" são pessoas diferentes de propósito.
- **FR09** Na **Ficha Técnica**, em ficha que veio de solicitação, ficam um atalho para o chat e o botão de devolver à Engenharia, ao lado de "Avisar Importação…". A Ficha continua sendo onde a Importação confere NCM e publica. **Decisão do Gelson** (item 4).
- **Fora do escopo:** aba/formulário "Cadastro" do HTML (duplicaria a Ficha); aba "Análise da Importação" (não há dado no banco para ela); cartão de NCM com Aprovar/Rejeitar dentro do chat (NCM é da Ficha); resposta do WhatsApp entrando no chat; mexer no funil `FWF` da Ficha (9 etapas de pré-venda); corrigir os achados de 8.3.8 (só com pedido).
- **Cenários de aceitação (sem teste ainda):** *Dado* uma solicitação em análise, *quando* a Engenharia devolve ao solicitante com motivo, *então* a marca aparece, o solicitante é avisado, e **só ele** consegue responder. *Dado* uma Ficha criada e ainda não publicada, *quando* a Importação devolve à Engenharia, *então* a solicitação fica "Devolvida à Engenharia — pendente de resposta" com prazo de 4 h e qualquer pessoa da Engenharia responde. *Dado* uma pendência respondida, *então* a marca some e a linha do tempo mostra quem respondeu.

**Clarify — respostas do Gelson (04/11/2026).**
1. Chat completo como no HTML (conversa livre, anexos, WhatsApp opcional). 2. Quem devolve: pessoas dos departamentos conforme documentado. 6. SLA em horário comercial, 09–17 h de Brasília (04/11/2026). 7. "Siga as recomendadas" (04/11/2026): o SLA de 4 h vale para **todas** as devoluções; vencido, só a **marca "atrasada" na tela** (sem aviso por WhatsApp nem cron nesta entrega); Administrador responde qualquer devolução; os dois achados de 8.3.8 (filtro atrasado e Voltar que não volta) são **corrigidos nesta entrega**. 3. 1ª volta ao Solicitante (só ele responde); 2ª volta da Importação à Engenharia (qualquer habilitado da Engenharia, ainda que um nome seja citado); Engenharia → Importação do mesmo modo. 4. Dados de NCM/cadastro **ficam na Ficha**; dúvida da Importação volta à Engenharia pelo chat. 5. A devolução à Engenharia marca "pendente de resposta" com SLA de 4 h. O HTML só complementa a tela de Solicitações; nada de sidebar.

**Plan.**
- **Estado = pendência por cima do status, não status novo.** O `status` do ciclo (`em_analise`, `convertido_em_ficha`…) não muda; ganham colunas em `solicitacoes_produto`: `pendente_com` (`solicitante`|`engenharia`|`importacao`|nulo), `pendente_desde`, `pendente_prazo`, `pendente_motivo`. Motivo: a Ficha já foi criada e não "volta" a `pronto`; a lista continua filtrando por status e ganha o filtro "Pendente de resposta". **Suposição**, a confirmar.
- **Chat:** tabela nova `solicitacao_produto_mensagens` (solicitação, autor, departamento, texto, anexos jsonb, `cita_email`, tipo `mensagem|devolucao|resposta`, hora). Nasce **fechada** (só usuário ativo; autor = `vp_email()`), **imutável** (sem update/delete). Anexos no bucket `engenharia`, pasta `solicitacoes/<id>/chat/`. Atualização por Realtime (a tabela entra na publicação) com recarga a cada 30 s como reserva.
- **Eventos:** o CHECK de `solicitacao_produto_eventos.tipo` ganha `devolvida` e `devolucao_respondida`.
- **Regra no banco:** funções `solicitacao_devolver` e `solicitacao_responder` (SECURITY DEFINER): conferem que quem responde a devolução ao solicitante é o `solicitante_email` (ou Administrador). A conferência de departamento (Engenharia/Importação) **fica na tela**, porque as listas moram no código (limite honesto, Art. 25 e #571).
- **Regras puras testadas:** em `solicitacoes-produto-timeline-calc.js` — quem pode responder, prazo de 4 h comerciais, frases novas e indicador de etapas com "devolvida". O prazo de 4 h comerciais em **09–17 h** exige função própria: `somarHorasComerciais` de `gatilhos-engine.js` tem a janela **08–18 h fixa** (`EXPEDIENTE`, usada pela Precificação) e não aceita outra. Não se altera a da Precificação; cria-se uma em `solicitacoes-produto-timeline-calc.js`, com teste (horário de Brasília, fim de semana, feriado, virada de dia).
- **Tela:** o detalhe ganha abas Informações · Chat · Análise de Engenharia, com a aba na URL (`/engenharia/solicitacoes-produto/<id>/<aba>`, `useRotaItem`, Art. 22). O chat vai em **arquivo novo** `solicitacoes-produto-chat.jsx` (o `.jsx` atual já tem 1.194 linhas, Art. 21). A Ficha (`ficha-tecnica.jsx`) ganha só o atalho e o botão.
- **WhatsApp:** `_avisar` já existente. O título leva o resumo da mensagem (o gi-avisos agrupa por título sem números por 24 h e ignora "teste", "claude", "excluir", S2.5).

**Tasks.** T001 migration (**só com "Confirmo"**) · T002 regras puras + testes · T003 store (devolver, responder, mensagens, anexos, eventos, avisos; erro de gravação sempre conferido, Art. 9) · T004 `solicitacoes-produto-chat.jsx` · T005 abas e URL no detalhe · T006 marca e filtro na lista · T007 atalho e botão na Ficha · T008 linha do tempo · T009 Realtime · T010 testes (unidade + e2e de fumaça da rota, abrindo a tela de verdade, Art. 34) · T011 `?v=` de cada arquivo tocado + mapa de rotas · T012 este documento, "?" e Copiloto (UPDATE em `vp_copiloto_docs`), `npm run rag` · T013 tutorial pela sessão de tutoriais (Art. 46) · T014 corrigir o filtro atrasado e o Voltar (8.3.8), com teste.
*Andamento (04/11/2026):* **T002 feito** (regras puras e 8 testes novos em `solicitacoes-produto-timeline-calc.js`, `?v=4`); **T001 redigida e aguardando o "Confirmo" do Gelson** — nada aplicado no banco; as demais tarefas dependem das colunas da T001.

**Analyze — achados e riscos.**
1. **Nome repetido:** o funil `FWF` já tem um botão "Devolver à Engenharia" na etapa `comercial_custo` (outro processo, pré-venda). A nova devolução usa rótulo próprio ("Devolver à Engenharia — dúvida da Importação") e **não mexe no `FWF`**. **Conferido** em `ficha-workflow-engine.js`.
2. **O papel do funil `FWF` é local:** `fwRole()` lê `localStorage` e assume `admin` por padrão — não identifica ninguém. Por isso a nova regra **não** usa o `FWF`; usa e-mail logado e as listas de departamento. **Conferido.**
3. **"Publicada" não se lê da `etapa`:** 93 fichas têm `omie_publicado_em` e só 1 está em `publicado` (8.4.8). A devolução à Engenharia fica bloqueada quando há `omie_publicado_em`, e não olha a `etapa`.
4. **Teste em produção deixa lixo:** mensagens e eventos são imutáveis (sem delete), logo um registro de teste real **não pode ser apagado** (Art. 10). Os testes serão em transação desfeita no banco e no e2e com Supabase simulado; **nenhum registro de teste em produção**.
5. **Segurança:** só a regra do solicitante fica no banco; as de departamento são da tela. Quem usa a chave pública consegue escrever no chat (#571).
6. **Os dois achados de 8.3.8** (filtro atrasado e Voltar que não volta) afetam a navegação por abas nova; entram nesta entrega por decisão do Gelson (T014).
7. **Sem dado real para testar o fluxo:** as 3 solicitações ativas já estão `convertido_em_ficha`. O fluxo de devolução à Engenharia só se vê de ponta a ponta em produção, com um caso real.

### 8.3.11 Histórico
Criada em 20/09/2026; alçadas em 28/09 (#407); formulário "para leigo" em 28/09 (#411); lixeira/soft-delete em 28/09 (#429); campos do FO-612 e "Código" opcional em 26/10; fluxo de avisos por WhatsApp em 30/10/2026; escolha de quem avisar nas duas etapas e linha do tempo real em 03/11/2026 (decisão do Gelson). **Herdado.**

---

## 8.4 Ficha Técnica

### 8.4.1 O que é
O **gerador universal de fichas técnicas**: cada produto tem uma ficha com identificação, categorias de campos (dimensões, peso, elétricas…), fotos, classificação fiscal (NCM/DUIMP) e pré-visualização/PDF. Salvar uma ficha **cria ou atualiza o produto no Catálogo** (`catalogo_produtos`), e o botão **Publicar no Omie** cria/atualiza o produto no ERP e anexa o PDF. **Conferido** em `ficha-tecnica.jsx` (1.211 linhas), `-engine.js` (419), `-store.js` (272), `-imagens.js`, `-copiloto.jsx` e `ficha-omie-publish.js`, 01/11/2026.

**Fora do escopo:** o Catálogo Siscomex e o funil de etapas (`ficha-workflow.jsx`, tema 7.8); a lista de produtos do Omie (3 e 13); a Solicitação (8.3).

### 8.4.2 Rota e arquivos
Rota `ficha-tecnica`; URL `/engenharia/ficha-tecnica[/<id>|/nova-ficha-tecnica]` (ficha aberta e editor novo na URL). Entradas por `sessionStorage`: `vpprd_ft_open` (lápis do Catálogo) e `vp_pcp_ficha_nova` (Relatórios do PCP). Fotos no bucket **privado** `fichas-imagens` (≤ 5 MB, comprimidas a 1280 px); fotos copiadas para o Omie vão ao bucket público `engenharia/produtos-fotos/`. **Conferido.**

### 8.4.3 Perfil e acesso
Alçada `ficha-tecnica` com cinco ações no catálogo: Ver, Criar, Editar, Excluir e **publicar_omie**. **Só `publicar_omie` é conferida** (botão desabilitado sem ela; Administrador passa). Criar, editar e excluir **não** são conferidas na tela. **Conferido.** O Copiloto VP (bolinha geral) é escondido nesta rota; a IA da ficha é o Copiloto NCM.

### 8.4.4 O que a tela mostra
Cabeçalho "ENGENHARIA · FICHA TÉCNICA", abas **▦ Painel** e **+ Nova ficha**.
- **Painel:** três números (Fichas totais, Categorias distintas, Vinculadas no Catálogo), busca ("nº, produto, SKU…") e tabela Ficha · Produto · Categoria · SKU · Criada · Ações (**Abrir**, **Excluir**).
- **Editor:** barra com **Nome do produto\***, **Cancelar**, **Salvar ficha**, **Gerar PDF**, **Publicar no Omie** / **Republicar** (e "Publicado no Omie em…"); barra lateral com as categorias e campos (busca, ligar/desligar campo, **+ campo**, **+ categoria**, modelos rápidos); coluna de edição (Descrição comercial/técnica, Categoria/Segmento, **Código do Produto (Omie)\***, Part Number, Marca, Modelo, Unidade (Omie), FCI, **SKU gerado automaticamente**, bloco "NCM / DUIMP" com insumo, "É parte de?", função/aplicação, forma/estado, NCM recomendado e **Descrição DUIMP**, desenho e foto); coluna de **pré-visualização** da ficha (paisagem ou retrato conforme a mídia).
- **Copiloto NCM** (bolinha arrastável, lembra a posição): **Analisar** (NCM recomendado, alertas, resposta à pergunta digitada) e **📝 Preencher a ficha** (propõe identificação, classificação e campos técnicos, cada um com a origem).

### 8.4.5 Botões e controles
**Salvar ficha** e **Gerar PDF** só liberam com `podeGerar` (nome + ao menos um grupo de campo preenchido); **Publicar no Omie** exige código preenchido, ficha **já salva** e a alçada. A categoria nativa não se exclui; categoria e campo **criados por usuário** têm botão de excluir (com `confirm`) que os tira da biblioteca. Modelos rápidos: "Rolamento 6205" e "Cabo de Aço 8mm". O Copiloto **nunca** grava sozinho: o usuário marca o que quer e clica **Aplicar marcados**.

### 8.4.6 Comportamento
- **Salvar:** nova ficha pede `next_doc_number('VPFT')`, sincroniza `catalogo_produtos` **primeiro**, depois insere a ficha, grava `VPLog` e registra no histórico do funil (`fichas_historico`, "criou"/"editou"). A ficha guarda o **retrato** de categorias/campos: mudar a biblioteca **não** altera fichas salvas.
- **Biblioteca:** categorias/campos novos entram em `fichas_lib_*` e aparecem nas fichas **novas**; nome duplicado (sem acento/caixa) é barrado; `c_madeira_test` ("Compatível com Fabricante") é protegida.
- **Gerar PDF** (overlay): html2canvas + jsPDF com paginação por blocos (`.ft-fz-grp`, `.ft-fz-descterm`, `.ft-fz-ident`, `.ft-fz-footer` nunca partem ao meio). **Nova seção que deva ficar inteira** = acrescentar a classe ao `querySelectorAll`.
- **Publicar no Omie:** gera o PDF, chama a Edge Function `publicar_ficha_omie` (PC-5), que cria/atualiza o produto, sincroniza campos, foto e características e substitui o anexo; a tela passa a mostrar a data e herda o código criado.
- **SKU automático** é determinístico (mesma ficha → mesmo SKU) por dicionário fixo de siglas (PC-4).

### 8.4.7 Dados
Lê/grava `fichas_tecnicas` (**395 linhas**, 0 arquivadas; 288 criadas, 800+ edições no histórico), `catalogo_produtos` (**400**), `fichas_lib_categorias` (5) e `fichas_lib_campos` (159), `fichas_historico` (**1.089**: 288 "criou", 800 "editou", 1 "publicou"), `vp_logs` (módulo "Ficha Técnica": **1.606**). Da base: **288** fichas com foto, **339** com desenho, **45** com NCM recomendado, **392** com código, **93** publicadas no Omie, **8** criadas nos últimos 30 dias. **Conferido** por SELECT em 01/11/2026. O Painel de Controle (`supabase.js`) lê **todas** as fichas e o catálogo (`select *`, sem `.range()`).

### 8.4.8 Regras e armadilhas
- **Achado grave, sem correção — exclusão física:** `FTStore.remove` faz `DELETE` em `catalogo_produtos` **e** em `fichas_tecnicas`, sem soft-delete; as duas tabelas aceitam DELETE da chave pública (PC-6). A janela de exclusão pede motivo e lista as consequências, mas **não confere alçada** (a ação Excluir existe no catálogo e não é lida). Fichas são **dados reais protegidos**; é o mesmo risco de 7.8.8. **Conferido.**
- **Achado:** `FTStore.update` **não confere o erro** do `update` (falha de gravação passa como sucesso, Art. 9); `syncCatalogoProduto` só dá `console.warn`; `createDraft` grava o catálogo **antes** da ficha — se o insert da ficha falha, sobra linha órfã em `catalogo_produtos` (hoje há **6** linhas do catálogo sem ficha). **Conferido.**
- **Achado:** a ficha **publicada no Omie não muda de etapa**: das 395 fichas, **93** têm `omie_publicado_em`, mas só **1** está em `publicado` (66 delas ainda em `comercial_rascunho`, 27 em `importacao`); a função não atualiza `etapa`. Os dois marcadores do mesmo fato divergem. **Conferido.**
- **Corrigido em 03/11/2026 — código do produto se perdia e gerava produto duplicado no Omie:** a função `publicar_ficha_omie` grava o código novo só na coluna `fichas_tecnicas.codigo_produto`, mas o editor lê `identificacao.codigoProduto` (jsonb). A ficha reabria com `VPEL-` e o "Salvar" regravava o prefixo na coluna; com só o prefixo, a publicação seguinte criava **outro** produto (caso VPFT20261026_7: `VPEL-739` criado 4 vezes e `VPEL-740` 1 vez, conforme `vp_logs`). Agora a tela grava o código também no jsonb logo após publicar (`FTStore.gravarCodigoPublicado`, que lança o erro) e `FTStore.update` não troca um código já numerado por prefixo solto. A função não foi alterada. A ficha VPFT20261026_7 teve o código ajustado para `VPEL-739` (Omie conferido: produto 9237694844). **Conferido** por SELECT, consulta ao Omie e `npm test`; publicação real **não** testada. Não se sabe quantos produtos duplicados restam no Omie.
- **Selo de situação no Omie (03/11/2026):** ao lado de "Publicar/Republicar no Omie" a tela mostra "✓ Publicado no Omie em …" (verde) ou "Ainda não publicado no Omie" (âmbar), pulsando 4 vezes ao abrir/publicar (sem animação com "reduzir movimento"). **Conferido** no navegador.
- **Achado:** o PDF enviado ao Omie (`ficha-omie-publish.js`) é uma **única página** com a imagem esticada ao tamanho A4 (`addImage(…, 0, 0, pw, ph)`); ficha alta fica distorcida, ao contrário do "Gerar PDF" do overlay (paginado). **Conferido** no código; não gerei um PDF para ver.
- **Achado de dados:** 1 código de produto repetido em duas fichas; prefixos fora do padrão (`" VPB"` com espaço, `"VPEl"`, `"OAK"`, `"SEQUOIA"`); 1 ficha sem `produto_id`. **Conferido.**
- A mensagem "Campos faltando: revise campos com * e Descrição Técnica" não bate com a regra (`podeGerar` = nome + um grupo preenchido). **Conferido.**
- O evento `FICHA_TECNICA_CRIADA` está no catálogo de eventos mas **nenhum código o emite**; o nó `FICHA_CRIADA` do motor nunca fecha (`fecha: null`). **Conferido.**
- A Edge Function `ncm-duimp-assist` (v27) segue ativa, mas **nenhuma tela a chama mais**: a IA migrou para a VPS em 26/10. **Não verificado** se algo externo a usa.
- **Não use `Excluir categoria/campo` da biblioteca como limpeza:** afeta só o que as fichas novas oferecem, mas apaga para todos.

### 8.4.9 Testes
**Nenhum teste de unidade** da engine (`buildSKU`, `compile`, `podeGerar`), do store ou da tela, apesar de haver regra de negócio (SKU). e2e: **não rodei**. **Cenário (sem teste):** *Dado* uma ficha com nome e um campo preenchido, *quando* salvo, *então* nasce a ficha, a linha no catálogo e o registro "criou" no histórico.

### 8.4.10 Pendências e decisões
**Decisão do Gelson:** (1) trocar a exclusão física por soft-delete/alçada (ficha e catálogo); (2) fazer a publicação no Omie avançar a etapa; (3) PDF do Omie em várias páginas; (4) unificar os prefixos e o código repetido. Testes da engine. Tutorial e "?" (PC-10).

### 8.4.11 Histórico
Criada em junho/2026 (primeira ficha em 03/06); múltiplas páginas e biblioteca compartilhada (jun–set); publicação no Omie, mapeamento célula a célula, características e foto (setembro a outubro); Copiloto NCM na VPS e "Preencher a ficha" em 26/10/2026; código só com prefixo gera o próximo número em outubro. **Herdado.**

---

## 8.5 Linha do Tempo da Cotação

### 8.5.1 O que é
A tela de **leitura** que junta, em ordem, tudo o que já aconteceu numa cotação — "quem fez o quê" —, a partir do Nº da cotação. Não grava nada e não tem tabela própria. **Conferido** em `linha-do-tempo.jsx` (133 linhas) e `linha-do-tempo-store.js` (130), 01/11/2026.

**Fora do escopo:** o Controle de Cotações e os prazos (1.4 e 4.2); a Evolução dos Equipamentos (9).

### 8.5.2 Rota e arquivos
Rota `linha-do-tempo`; URL `/engenharia/linha-do-tempo[/<Nº>]` (o Nº vem da URL e busca sozinho; **digitar na caixa não escreve na URL**). O Inbox liga para esta rota. Arquivos `linha-do-tempo.jsx` (`window.LinhaDoTempoPage`), `linha-do-tempo-store.js`. **Conferido.**

### 8.5.3 Perfil e acesso
Sem `restrict` e sem `temCapacidade`; alçada `linha-do-tempo` no catálogo (não conferida). **Não aplica a regra de dono** do Formulário nem as do Inbox (ver 8.5.8). **Conferido.**

### 8.5.4 O que a tela mostra
"ENGENHARIA · LINHA DO TEMPO DA COTAÇÃO"; caixa **Nº Cotação** (aceita `902` ou `VPEL-EL0902`) e **Buscar**. Resultado: faixa escura com o Master ID, obra e cliente (se há Dossiê), "Nasceu em" (data do 1º evento) e o status do Dossiê; depois a linha vertical com, em cada item, um selo colorido do **papel** (Cliente, Vendedor, Fornecedor, Financeiro, Jurídico, Engenharia, Importação, CEO, RH, Transporte marítimo/terrestre, Despachante, Instalador, Gestão…), a ação, "por <ator> · <fonte>" e data/hora. Sem resultado: "Nenhum registro encontrado pra essa cotação…".

### 8.5.5 Botões e controles
Só **Buscar** (ou Enter).

### 8.5.6 Comportamento
Reúne seis fontes por `numero_cotacao`, sem tabela de eventos nova: **(1)** `eventos_fluxo` (funil comercial → Engenharia); **(2)** Dossiê da Obra (`dossier_obra`) + histórico de status (`dossier_history`), vistorias concluídas (`vistorias_atividades`), equipamento recebido e itens do checklist de instalação; **(3)** decisões gerenciais aprovadas/reprovadas (Central de Decisões); **(4)** P.I. (abertura e dois pagamentos); **(5)** Embarque (saída do navio, chegada a Santos — real se há presença de carga, senão "estimativa" —, DUIMP, conferência, entrega); **(6)** e-mails vinculados (`emails_projeto`, entrada/saída, **papel "Fornecedor" é aproximação** para toda entrada). Ordena por data. Itens sem data são ignorados.

### 8.5.7 Dados
Só lê: `eventos_fluxo` (**506**), `dossier_obra`, `dossier_history`, `vistorias_atividades`, `instalacao_checklist_itens`, `decisoes_gerenciais`, `pi_importacao` (31), `embarques_importacao` (11), `emails_projeto` (**66** vinculados a alguma cotação). **Conferido.**

### 8.5.8 Regras e armadilhas
- **Achado — vazamento de leitura:** a busca por Nº **não passa** pela regra de dono do Formulário (`formularios.ver_de_outros`) nem pelas regras de visibilidade do Inbox; qualquer pessoa com a rota vê assunto, remetente e data dos e-mails de uma cotação alheia (o texto do e-mail, `detalhe.preview`, é carregado mas **não exibido**). Mesmo padrão da Tratativa (4.3). **Conferido.**
- **Achado — erro engolido:** as consultas destructuram só `{ data }` (sem `error`); uma falha parcial some da linha do tempo e a tela mostra uma linha do tempo **incompleta como se fosse completa** (Art. 9). Só o erro geral da busca vira aviso. **Conferido.**
- **Achado:** leituras sem `.range()` (cotação com muitos e-mails) e `limit(1)` do Dossiê; cotação sem Dossiê só tem eventos, P.I., embarque e e-mails. **Conferido.**
- A linha do tempo **não mostra** Tratativas, edições de preço, contrato/aval além do que os eventos registram. **Conferido.**
- O papel `PAPEL_STATUS_DOSSIER` mapeia cada passagem de status do Dossiê a um papel típico; é aproximação, não quem de fato agiu.

### 8.5.9 Testes
Nenhum teste. e2e: **não rodei** (a rota está no teste de fumaça do CI). **Cenário (sem teste):** *Dado* a cotação 955, *quando* busco "955", *então* vejo o Formulário, a proposta, o contrato e o projeto assinado em ordem de data.

### 8.5.10 Pendências e decisões
Aplicar a regra de dono/visibilidade (**decisão do Gelson**, Art. 12 não se aplica: não há texto de módulo); mostrar erro parcial; incluir a Tratativa. Mostrar o preview do e-mail? Hoje carregado e não usado.

### 8.5.11 Histórico
Criada em 15/08/2026 como "Linha do Tempo da Cotação"; vistorias passaram a ler `vistorias_atividades` em 11/10/2026; chegada real (presença de carga) em 30/10/2026. **Herdado.**

---

## Parte comum de Engenharia & Produto

### PC-1 Mapa de ligações
- **Entra:** Contrato de Venda assinado (6.1) → o projeto da obra; Proposta/Precificação (4.5, 5.2) → os códigos dos equipamentos; Formulário (4.1) → obra e cliente; Solicitação (8.3) → Ficha; Importação Varejo e Relatórios do PCP → "Criar ficha deste item".
- **Sai:** Projeto de Instalação assinado → **Aval Engenharia** (5.3 e 4.3 "Decidir comprar"); Ficha Técnica → Catálogo Siscomex (7.8), Omie (PC-5), **foto do produto** nas Cotações de Varejo (7.10) e no painel "Produtos com foto" do PCP (13); busca de produto na P.I. (7.2) e nos pedidos a fornecedor; Linha do Tempo ← Inbox.

### PC-2 Os dois fluxos de ponta a ponta
**A. Produto novo:** quem não acha o produto cria a **Solicitação** (8.3) → WhatsApp para Gelson, Vinicius e Alexandre → **Iniciar análise** → **Pronto** → **Converter em Ficha** → WhatsApp para Beatriz e Andréia → a ficha é completada, o **NCM** confirmado (Copiloto NCM) → **Publicar no Omie** (PC-5) → o produto aparece no Omie e na Compras (7.9). **B. Projeto da obra:** Contrato de Venda assinado → a Engenharia salva **Projeto de Instalação + ID-TAG** com os códigos (8.1) → cria o link → o representante assina em `/assinar` → o banco avisa a Engenharia e emite o evento → **Aval Engenharia OK** → com os avais de Pagamento e Jurídico (e CEO se a margem exige), o **"Decidir comprar"** libera. **Herdado** (CLAUDE.md 05/10, 08/10, 30/10), lido no código acima.

### PC-3 Rotas e código sem item de menu
- **Hub Engenharia** (`engenharia`, `EngenhariaPage` em `operacoes.jsx`): saiu do menu em 30/10/2026; a rota abre. Usa `project-gates.js` (gate "PDF Projeto" lendo a coluna inexistente do 8.2.8). Apagar só com pedido. **Herdado/Conferido.**
- **Kanban "Solicitações NCM"** (`ncm-kanban`, `ncm-detail`; em `ncm-catalogo.jsx`): fila de classificação NCM em cinco colunas (Em preenchimento, Aguard. jurídico, Aprovado jurídico, Pronto LogComex, Cadastrado Siscomex; mover o card **não** cadastra nada) com exportação LogComex. Sem item de menu; só por URL; `NcmDashboardWidget`, que levava até ele, **não é usado por nenhuma tela**. Tabela `ncm_solicitacoes`: **0 linhas**, leitura/inserção/atualização abertas. **Conferido.**
- **Funil de etapas da ficha** (`ficha-workflow*.js`): exibido no Catálogo (7.8); cada ficha tem `etapa` (9 etapas Comercial → Engenharia → … → Publicado). 288/106/1 por etapa (ver 8.4.8).

### PC-4 Código do produto e SKU
- O **Código do Produto (Omie)** é o que o Omie usa (`VPEL-1000`). Prefixos com **geração automática** do próximo número: **VPEL, VPER, VPB, VPMP** (função `proximo-codigo-produto`, outro projeto Supabase). Código vazio ou **só o prefixo** na ficha = produto novo; **com número** = produto existente. Outros prefixos (VPIN, VPCON, VPAT, VPKIT) a Engenharia digita completo. **Conferido** (v44 da função + `solicitacoes-produto-store.js`).
- **SKU automático** (`FT.buildSKU`): padrão `VPEL-PP-TEL-AD-IN-800X2100-258` (prefixo, iniciais do tipo, siglas do dicionário `SKU_DICIONARIO`, vão × altura, sequencial); ampliar o dicionário é no código. Não é gravado como código do Omie. **Conferido.**

### PC-5 Da Ficha Técnica ao Omie
**Herdado** das decisões fechadas com o Gelson em 28/09 (CLAUDE.md) e **reconferido** na função v44 em produção (mesmos marcadores do arquivo do repositório; **não comparei linha a linha**).
- **Fluxo da função:** valida o PDF e o limite de taxa (30/IP, 60 global por 10 min) → se o código é novo, exige **NCM** e a categoria, pede o próximo código e faz `IncluirProduto` (**tipo "00" e origem "1" só na criação**, nunca reenviados) → `ConsultarProduto` → `AlterarProduto` com os campos "vivos" (descrição, unidade, marca, modelo, peso, **dimensões ÷ 10 de mm para cm — nunca remover**, CEST aninhado em `recomendacoes_fiscais`, descr. detalhada, obs. internas = DUIMP + Descrição Técnica, **foto**) → **características** (catálogo geral + valor por produto, por `nCodProd`) → apaga o anexo antigo e **anexa o novo PDF** → grava `omie_anexo_id`/`omie_publicado_em` e o log.
- **NCM:** sempre `ncm_recomendado`. **EAN/Part Number soltos** e **FCI** nunca vão (FCI não tem campo na API). Código ANVISA/ANP saíram da categoria "Códigos".
- **Escrita real no Omie** (Art. 30): só por clique na ficha, com a alçada `publicar_omie`. **A função não confere alçada no servidor**: quem chama a Edge Function com um JWT válido publica. **Conferido.**
- **Importa `supabase-js` e `fflate` via esm.sh** (Art. 23: uma das funções antigas; não redeployar sem comparar com o repositório e testar numa cópia). Chama `proximo-codigo-produto` com uma chave publicável embutida no código (chave pública por definição, de outro projeto).
- Erros do Omie ("consumo redundante") viram aviso "aguarde N s". Publicação em produto **novo** e em produto **existente** passam por caminhos diferentes: **teste os dois** ao mexer (lição de 28/09).

### PC-6 Identidade, alçadas e segurança
- **Estado real das políticas (Conferido em `pg_policies`, 01/11/2026):** `fichas_tecnicas`, `fichas_lib_categorias`, `fichas_lib_campos` — **tudo (inclusive DELETE) para `anon` e `authenticated`**. `catalogo_produtos` — as quatro abertas ao público, inclusive DELETE. `solicitacoes_produto` — `authenticated` tudo; `anon` inserir, ler e atualizar. `fichas_historico` — só inserir e ler (histórico imutável). `projetos_elevador`, `projetos_elevador_desenhos`, `equipamentos_spec`, `ncm_solicitacoes`, `eventos_fluxo` — ler/inserir/atualizar abertos ao público, **sem DELETE** (a tabela de desenhos só apaga "soft"). `documento_signatarios` — as quatro abertas (do módulo 6). `obra_art` — fechada por alçada (9).
- **Alçadas:** só `solicitacoes-produto` (criar, excluir) e `ficha-tecnica.publicar_omie` são conferidas no código. As outras ações declaradas no catálogo não são lidas. O e-mail do usuário vem do navegador (Art. 25): a trava na tela é organização, não segurança.
- Fotos de ficha em bucket privado com link assinado; anexos de solicitação, projeto e equipamento em bucket **público**.

### PC-7 Gatilhos, eventos e funções
- **Banco (Conferido em `pg_trigger`):** em `documento_signatarios`: `trg_projeto_instalacao_alertar` (avisa a Engenharia quando o Projeto é assinado/recusado), `trg_projeto_instalacao_enfileirar` (enfileira o evento quando o último Projeto da cotação é assinado) e `trg_projeto_instalacao_avais_ok` (aviso "avais OK"). Nenhum gatilho nas tabelas `fichas_*`, `solicitacoes_produto` ou `projetos_*`. **Nenhum cron** é deste módulo (o `evolucao-alerta-felipe-diario` é do 9).
- **Eventos:** `PROJETO_ELEVADOR_CRIADO`, `PROJETO_ELEVADOR_FINALIZADO`, `PROJETO_INSTALACAO_ASSINADO`; `FICHA_TECNICA_CRIADA` **sem emissor**. Nós do motor: `PROJETO_CRIADO` (nasce no contrato assinado, fecha no evento criado), `PROJETO_ENVIADO` (SLA 24 h, fecha no finalizado), `AVAL_ENGENHARIA`, `FICHA_CRIADA` (nunca fecha). **Conferido** (`gatilhos-engine.js`).
- **Edge Functions (Conferido ACTIVE):** `publicar_ficha_omie` (v44), `ncm-duimp-assist` (v27, sem chamador), `vp-copiloto` (v36; texto das telas; **removida em 01/11/2026**, ver `15_servicos.md` S3), `vp-translate` e `vp-translate-to-pt` (usadas por outros módulos). A IA da ficha roda **na VPS** (`copiloto.vpsistema.com/ncm`, cota de 20 perguntas por hora por pessoa, login do usuário), fora do Supabase.

### PC-8 Tabelas
`projetos_elevador` (0), `projetos_elevador_desenhos` (4; 3 ativas), `equipamentos_spec` (3), `solicitacoes_produto` (9; 3 ativas), `fichas_tecnicas` (395), `fichas_lib_categorias` (5), `fichas_lib_campos` (159), `fichas_historico` (1.089), `catalogo_produtos` (400, compartilhada com 7.8), `ncm_solicitacoes` (0), `documento_signatarios` (tipo projeto: 2), `eventos_fluxo` (506, do 1). Contagens **Conferidas** por `count(*)` em 01/11/2026. **Realtime:** nenhuma tabela deste módulo.

### PC-9 Navegação, cache e testes
Regras de URL, `?v=` e testes: `01_geral.md` PC-9. Específico: abas por `useRouteTab` (8.1), novo/editar por `useRotaItem`/`useRotaId` (8.1, 8.2), ficha e solicitação por segmento de URL; **Nova solicitação, filtros e a janela de assinatura não ficam na URL**. `node scripts/check-cache-bust.js origin/main`: **ok** em 01/11/2026. `npm test`: **931 passaram, 0 falharam**. e2e: **não rodei**. **Não testei nada com clique real no navegador.**

### PC-10 Menu "?" e tutoriais
**Não existe** texto de ajuda (`HELP_TOPICS`) nem tutorial (`TUTORIAIS`, `TreinamentoVP/`) para nenhuma das cinco telas; só há texto para o hub fora do menu (`engenharia`) e para `ncm-kanban`. O Copiloto VP conhece as telas: `solicitacoes-produto` pela tabela `vp_copiloto_docs`; as outras quatro só pelo `ROUTE_DOCS` embutido na função. **Conferido.** Tutorial não se edita à mão: pedir à sessão de tutoriais.

### PC-11 Documentos soltos e destino do que foi concatenado
| Arquivo / seção | O que é | Destino |
|---|---|---|
| `CLAUDE.md` — "Módulo Ficha Técnica" | Paginação, biblioteca, categorias | **Concatenado em 8.4** (6, 8.4.6, 8.4.8) |
| `CLAUDE.md` — "Solicitações de Produto + mapeamento Ficha Técnica → Omie (28/09)", incl. alçadas, formulário leigo, mapeamento célula a célula, características dinâmicas, validação com ficha real, lixeira | 8.3, 8.4 | **Concatenado em 8.3, 8.4 e PC-5** |
| `CLAUDE.md` — "Copiloto VP — contexto da tela Solicitação de Produto" | Copiloto | Concatenado em 8.3.6 e PC-10 |
| `CLAUDE.md` — "Engenharia › Projeto de Elevadores — aba Desenhos" (equipamentos, ID-TAG, preenchimento, assinatura, aviso à Engenharia) | 8.1 | Concatenado em 8.1; a parte da assinatura é **mista** com o módulo 6 (área blindada e PDF assinado ficam lá) |
| `CLAUDE.md` — "Aval Engenharia" | Aval da compra | **Mista** (5, 6, 8): a regra está em 5 PC-3; o painel e o cartão estão em 8.1 |
| `CLAUDE.md` — "Hub Engenharia fora do menu" | Rota sem menu | Concatenado em PC-3 |
| `CLAUDE.md` — "Edge Functions: órfãs apagadas… como redeployar" | **Mista** (7 e 14) | Fica |
| `docs/superpowers/specs/2026-10-26-solicitacao-produto-fo612/` (5 arquivos) | Spec do FO-612 | **Histórico dentro do módulo** (8.3.11); fica onde está. A lista de tarefas está desatualizada (migrations já aplicadas) |
| `handoffs/desenho-tecnico-elevador/` | Motor de desenho de "Prancha de Instalação" (protótipo, **não integrado**, não carregado por nenhum HTML) | Histórico; **candidato a decisão**: o desenho do projeto hoje é PDF subido, não gerado. Fica |
| `docs/superpowers/specs/2026-10-31-mapa-de-destino-docs-soltos.md` | Mapa de destino geral | Já aponta a spec do FO-612 para este módulo |
| `docs/MAPA_DE_ROTAS.md` | Gerado | Fonte das URLs (Conferido) |
| `docs/seguranca/matriz-acesso-rls.md` | Matriz de RLS | Do módulo 14; PC-6 traz o estado destas tabelas |
| `docs/modulos/07_suprimentos_importacao.md` 7.8 e PC-11 | Catálogo e funil | Apontam para este módulo |
Nenhum arquivo foi apagado. **Parece obsoleto (decisão do Gelson):** o texto do bloco "PDF do Projeto (Inglês + Chinês)" no 8.2 e a tela "Especificação técnica" do 8.1 (0 linhas); `NcmDashboardWidget` (sem uso).

### PC-12 Benefícios trocados com os outros módulos
- **Recebido:** o selo de verificação e "achado, sem correção" (de todos); "rótulo do menu ≠ nome na URL/arquivo" (de 7: aqui `eng-configurador`, `engenharia-elevador.jsx`); a conferência de **nome de alçada × política do banco** (de 6) e a de **leitura que falha vira zero** (de 7), ambas encontradas aqui; o cuidado de **paginar** leituras acima de 1.000 linhas (do Geral).
- **Doado** (texto completo aqui; os outros apontam): (1) **o código grava colunas que o banco não tem** (8.2.8): conferir o payload de cada `insert/update` contra `information_schema.columns`; teste de unidade e compilação não pegam; (2) **alçada declarada e nunca lida** (8.4.3, 8.3.3): conferir não só o nome, mas se a **ação** do catálogo é checada no código; (3) **filtro que recarrega com o valor antigo** (8.3.8): `setX(v); recarregar()` lê o estado da renderização anterior; (4) **dois marcadores do mesmo fato** (8.4.8: etapa × `omie_publicado_em`, 1 × 93): procurar status e datas que deveriam andar juntos; (5) **vista decidida por `useState` e id lido só da URL** (8.3.8): o Voltar do navegador não volta à lista; (6) **arquivo apagado do Storage antes de salvar** (8.2.8). Registrado nos documentos 1 a 7.
- **Recebido de Obras & Instalação (01/11/2026, texto em `09_obras_instalacao.md` PC-12):** a Linha do Tempo (8.5) lê o Dossiê da Obra (9.1). Atenção a três coisas diferentes: o Projeto de Instalação assinado (8.1), a ART por obra (9.6) e o documento "ART (CREA)" do checklist do Dossiê (9.1). **Conferido** no código, 01/11/2026.
- **Recebido de Entrega & Documentação (01/11/2026, texto em `10_entrega_documentacao.md` PC-12):** as **quatro "casas" de documento** (Dossiê, Central, Repositório e **Projeto de Elevadores › Desenhos**, 8.1) estão comparadas na tabela do `10_entrega_documentacao.md` PC-4; o 8.1 é a casa do projeto **para enviar ao cliente**. **Conferido** nos textos das telas.
- **Recebido de Parceiros & Instaladores (01/11/2026, texto em `11_parceiros_instaladores.md` PC-12):** o **preço combinado** com o montador é cadastrado pela Engenharia (11.4) e a **ART** (9.6) nasce da primeira assinatura do Contrato Instalador; o item "Pagamentos a Instaladores" é restrito aos perfis financeiro, engenharia e admin. **Conferido** no código, 01/11/2026.
- **Recebido de Logística Interna (01/11/2026, texto em `12_logistica_interna.md` PC-12):** a etiqueta **ID-TAG do equipamento** (`EQP:<código>`) lê os equipamentos da obra pelo Projeto de Elevadores (8.1). **Herdado.**
- **Recebido de Fabricação (01/11/2026, texto em `13_fabricacao.md` PC-12):** a **Lista de fios** do quadro (13.7) é mantida pela Engenharia (alçada `lista-fios`) e hoje tem **0 fios** cadastrados; bitola grossa e conectores a informar. **Conferido** no banco, 01/11/2026.
- **Recebido de Administração (01/11/2026, texto em `14_administracao.md` PC-12):** o bucket `engenharia` (desenhos, projetos assinados, fotos de ficha) é **público**; o link de um desenho abre sem login. **Conferido** em `storage.buckets`.
- **Recebido de Serviços (01/11/2026, texto em `15_servicos.md` PC-2):** todo alerta com destinatário também vira WhatsApp pelo gi-avisos; para chegar certo, título curto com o essencial na frente, sem "teste", sem R$ no título e com o dia da semana por extenso, a obra ou o código do contrato quando houver vários no mesmo dia (o agrupamento de 24 h apaga números). **Conferido** no código do gi-avisos. O Copiloto em uso é o da VPS e **não lê** `vp_copiloto_docs`: o "ajuste por UPDATE sem redeploy" citado neste documento só valia para a Edge Function antiga `vp-copiloto`, removida em 01/11/2026 (`15_servicos.md` S3.5, divergência D1). **Conferido.**
