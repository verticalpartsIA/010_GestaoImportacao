# Qualidade de interface no hub — teste de acessibilidade + checklist da VP (2026-11-08)

> **Status (08/11/2026):** SPECIFY e CLARIFY respondidos ("Aceito as recomendações"); PLAN, TASKS e ANALYZE escritos abaixo. **Nada foi implementado.** Falta a decisão do Gelson sobre as correções do ANALYZE (seção 6) e os "Confirmo" de cada mudança sensível (seção 4, T001 e T005).
> **Origem:** os três links que o Gelson trouxe (Checklist Design, 10 heurísticas do NN/g, WCAG) e a auditoria piloto de 07/11/2026 (`docs/modulos/01_geral.md`, PC-11).
> **Decisões já dadas pelo Gelson (08/11/2026):** (1) vale **as duas coisas**: teste no CI **e** tela dentro do hub; (2) "personalizado" = **checklist com regras da VP** (perguntas próprias, derivadas da Constituição e do vocabulário do sistema).
> **Selo (Art. 6):** o que descreve o repositório abaixo é **Conferido em 08/11/2026** (leitura do `CLAUDE.md`); o que é proposta vem rotulado como proposta.

## 1. SPECIFY

### 1.1 Contexto e objetivo
A auditoria piloto achou problemas reais de acessibilidade (campos sem nome, contraste, alvos pequenos) em 4 de cerca de 100 telas. Hoje nada impede que o problema volte, e nada guarda o que foi revisado por pessoa. O objetivo é (a) um **teste automático** que pegue a parte objetiva (WCAG) a cada alteração e (b) uma **tela no hub** onde se vê o estado de cada tela e se registram revisões feitas por pessoas, com perguntas **escritas para o VP Gestão**, não genéricas.

### 1.2 Requisitos
- **FR01 — Teste automático de acessibilidade.** Abre um conjunto de telas-chave num navegador real e aponta violações WCAG 2.2 A/AA (gravidade crítica e séria). Roda a cada PR.
- **FR02 — Começa em modo aviso.** Não reprova o PR no início; passa a reprovar por decisão do Gelson, depois de um período combinado (mesmo padrão do Art. 52).
- **FR03 — Pendências conhecidas não reprovam.** Existe uma lista de violações já sabidas (hoje: amarelo do cabeçalho 2,38:1; etiqueta "Cotação Nº" 3,83:1; 10 páginas sem `?v=`). Só violação **nova** reprova.
- **FR04 — Tela no hub.** Lista as telas do hub com: resultado do último teste automático, última revisão humana (quem, quando, resultado) e pendências abertas.
- **FR05 — Checklist da VP por tela.** Cada tela tem perguntas próprias do VP Gestão (ver 1.4). A pessoa responde Ok / Falha / Não se aplica, com observação.
- **FR06 — Histórico imutável.** Cada revisão fica registrada e nunca é alterada nem apagada (padrão de `vp_logs`).
- **FR07 — Acesso por alçada.** Ver, registrar revisão e administrar o checklist são alçadas separadas; Administrador passa sempre.

### 1.3 Fora do escopo
- **Corrigir** os problemas que o teste ou a revisão apontarem (cada correção é outro pedido, Art. 8).
- Leitor de tela, zoom de 200% e celular **automatizados** (não há ferramenta confiável para isso aqui).
- Substituir ou renomear os checks atuais do CI (Art. 36: "Validar estrutura do projeto" e "Todas as telas abrem sem erro" não mudam).
- Nota de usuário final, pesquisa de satisfação, teste de usabilidade com clientes.

### 1.4 Checklist da VP — origem das perguntas (proposta, a revisar pelo Gelson)
Perguntas curtas, de sim/não, ligadas a regras que **já existem** na Constituição, por exemplo:
- Falha de gravação, consulta ou envio aparece como aviso na tela? (Art. 9)
- Mudança visual ou de fluxo foi aberta de verdade, não só lida no código? (Arts. 4 e 34)
- Os nomes na tela são os do sistema hoje ("Prazos & Pendências", não "Gatilhos")? (Glossário)
- Cadastro com transação não oferece excluir? (Art. 16)
- Exclusão é "soft" e pede confirmação? (Art. 27)
- Existe texto de ajuda do "?" e ele está atualizado? (Art. 46)
- Há `?v=` novo nos arquivos mexidos? (Art. 19)
Mais as perguntas de usabilidade das 10 heurísticas do NN/g, reescritas no vocabulário do sistema (status visível, erro que diz o que fazer, saída fácil, consistência).

### 1.5 Cenários de aceitação
1. *Dado* um PR que remove o nome de um campo do Formulário de Elevador, *quando* o CI roda, *então* o teste automático aponta a violação nova (em modo aviso: mostra; depois do período: reprova).
2. *Dado* a violação já conhecida do amarelo do cabeçalho, *quando* o CI roda, *então* ela não reprova.
3. *Dado* uma pessoa com a alçada de registrar revisão, *quando* ela abre a tela do hub e marca "Falha" com observação numa tela, *então* a revisão aparece no histórico com nome e data e não pode ser alterada.
4. *Dado* uma pessoa **sem** a alçada, *quando* ela abre a tela do hub, *então* só consulta.
5. *Dado* o resultado do último teste automático, *quando* a tela do hub carrega, *então* mostra a data do teste e quantas violações cada tela tem.

### 1.6 Regras da Constituição que valem aqui
- **Art. 14 e 31:** tabela nova ou migration só com "Confirmo" para aquela mudança.
- **Art. 26:** tabela nova nasce com RLS fechada (acesso por usuário ativo e alçada, não pela chave pública).
- **Art. 18:** dependência nova (o pacote do axe para o Playwright) pede justificativa escrita e confirmação. Fica só em desenvolvimento, não entra no site.
- **Art. 33 e 34:** tela nova se abre de verdade antes de declarar pronta; regra pura ganha teste de unidade.
- **Art. 36:** nomes dos checks do CI não mudam.
- **Art. 52:** documento do módulo, ajuda do "?" e índice RAG no mesmo PR.

## 2. CLARIFY — perguntas ao Gelson (numeradas)

1. **Quais telas entram no teste automático no começo?** Proposta: Login, Dashboard, Central de Decisões, Formulário de Elevador, Formulário do Quadro de Comando, Propostas, Aval Financeiro, Cadastros › Clientes, Pedidos a separar (Separação) e as páginas públicas `/assinar` e `formulario-cliente`. Acrescentar ou tirar alguma?
2. **Como o resultado do teste chega à tela do hub?** (a) o CI **gera um arquivo** de relatório que fica no repositório e a tela lê (não precisa de senha no CI; o resultado só atualiza a cada PR mesclado); ou (b) o CI **grava no banco** (resultado em tempo real, mas exige guardar uma credencial no CI, que hoje o repositório público evita, Art. 28). **Recomendo (a).**
3. **Quem registra revisão e quem administra o checklist?** Sugestão: registrar = qualquer pessoa ativa com a alçada nova; administrar as perguntas = só Administrador. Quais perfis recebem a alçada de registrar?
4. **Quem escreve as perguntas?** Proposta: eu rascunho a partir da Constituição e dos 10 itens do NN/g (1.4) e você revisa, corta e acrescenta. Combinado?
5. **Granularidade do checklist:** uma lista por **tela** (cerca de 100) ou uma lista por **módulo** (15) com as telas-chave dentro? Recomendo por módulo, com a possibilidade de uma tela ter perguntas extras.
6. **Quando o teste automático passa a reprovar PR?** Sugestão: 14 dias em modo aviso, depois reprova só violação nova, como no Art. 52 (uma semana de PRs reais). Aceita?
7. **Onde fica no menu e como se chama?** Sugestão: Administração › "Qualidade de interface". Outro nome ou lugar?
8. **A lista de pendências conhecidas (FR03)** fica no repositório (arquivo versionado, revisável em PR) ou no banco? Recomendo no repositório.

### 2.1 Respostas do Gelson (08/11/2026: "Aceito as recomendações")
1. Telas iniciais: as propostas (Login, Dashboard, Central de Decisões, Formulário de Elevador, Formulário do Quadro de Comando, Propostas, Aval Financeiro, Cadastros › Clientes, Pedidos a separar, `/assinar`, `formulario-cliente`). **Ajustado pelo ANALYZE A7 (correção aplicada em 08/11/2026):** no PR 1 entram só as telas que abrem **sem token e dentro do shell do hub**: Dashboard, Central de Decisões, Formulário de Elevador, Formulário do Quadro de Comando, Propostas, Aval Financeiro, Cadastros › Clientes, Pedidos a separar e `formulario-cliente`. **Ficam para depois:** `/assinar` (exige token; sem ele só mediria a tela de erro) e o Login (é o portal, fora do hub).
2. Resultado do CI no hub: **arquivo gerado no repositório**, sem credencial no CI. *(Ver ANALYZE A2: o arquivo é gerado localmente e commitado, não pelo CI.)*
3. Registrar revisão = qualquer pessoa ativa com a alçada nova; administrar as perguntas = só Administrador. **Quais perfis recebem a alçada não foi dito:** nasce só com o Administrador e o Gelson concede em Administração › Alçadas.
4. Perguntas: eu rascunho, o Gelson revisa. Entram marcadas "rascunho, não revisado".
5. Checklist **por módulo** (15), com possibilidade de pergunta extra por tela.
6. Teste só avisa por 14 dias; depois reprova só violação nova.
7. Menu: Administração › "Qualidade de interface".
8. Pendências conhecidas: arquivo versionado no repositório.

## 3. PLAN (proposta)

### 3.1 Duas entregas separadas (dois PRs, o primeiro sem banco)
- **PR 1 — o teste (sem banco, sem tela):** dependência do axe, `e2e/acessibilidade.spec.js`, lista de pendências conhecidas, script que gera o relatório. Entrega valor sozinho e é reversível.
- **PR 2 — o hub (banco + tela):** tabelas, alçadas, tela, documentos. Depende do PR 1 só para ler o relatório.

### 3.2 O teste (PR 1)
- Arquivo `e2e/acessibilidade.spec.js`, dentro do mesmo `playwright test` (mesmo job "Todas as telas abrem sem erro": o nome do check não muda, Art. 36).
- Para cada tela da lista: abre, espera a tela, roda o axe com as regras `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, filtra gravidade **crítica e séria** e compara com `e2e/acessibilidade-conhecidas.json` (lista de `{tela, regra, alvo}` já sabidas). Violação fora da lista = nova.
- Modo pela variável `A11Y_MODO`: `aviso` (padrão: mostra as novas, não reprova) ou `falha` (reprova). A virada para `falha` é uma edição pequena no workflow, com data combinada (14 dias).
- Dependência (justificativa escrita, Art. 18): `@axe-core/playwright` em `devDependencies`, **só para os testes, não entra no site**. Licença MPL-2.0. **Conferido em 08/11/2026 no registro do npm:** exige `playwright-core >= 1.0.0` (serve ao `@playwright/test 1.56.1` fixado) e traz o `axe-core` como dependência. A última, 4.14.0, saiu em 06/11/2026 (2 dias); proposta: **fixar `4.10.2`** (depende de `axe-core ~4.10.3`), a série mais próxima do `axe-core 4.10.2` com que fiz a auditoria de 07/11, e subir de versão só por decisão. *(Diferença de patch entre 4.10.2 e 4.10.3: não medi se muda algum resultado.)*
- Relatório: `npm run a11y:relatorio` roda o spec e grava `src/qualidade-relatorio.json` (`geradoEm`, `commit`, e por tela: rota, nº de violações, regras, alvos). Fica em `src/` porque o servidor só serve `src`, `styles`, `assets` e `TreinamentoVP` (ANALYZE A1).

### 3.3 O hub (PR 2)
**Banco** (migration, só com "Confirmo", Arts. 14, 26, 27, 31):
- `qualidade_perguntas`: `id`, `modulo` (número 1 a 16), `tela` (opcional), `texto`, `origem` (artigo ou heurística), `ordem`, `ativo`, `rascunho` (verdadeiro até o Gelson revisar). Sem DELETE: some pelo `ativo`.
- `qualidade_revisoes`: **imutável** (trigger que barra update e delete, como `etiqueta_impressoes`). `id`, `modulo`, `tela`, `pergunta_id`, `pergunta_texto` (cópia do texto no dia, para o histórico não mudar se a pergunta mudar), `resultado` (`ok`/`falha`/`na`), `observacao`, `revisado_por` (e-mail do login, por padrão), `revisado_em`.
- Ambas **nascem com RLS fechada**: `revoke` de `anon`, leitura só para usuário ativo com a alçada, escrita só com a alçada certa.
- Alçadas novas no módulo `qualidade-interface`: `ver`, `revisar`, `administrar`. Carga inicial: nenhuma (Administrador passa sempre).
- Seed de perguntas (cerca de 12, da seção 1.4) como `rascunho = true`.

**Front** (sem build, Art. 18; arquivos pequenos, Art. 21):
- `src/qualidade-interface-calc.js` (puro, com teste): resumo por módulo, cruzamento do relatório com as revisões, "revisão vencida".
- `src/qualidade-interface-store.js`: leitura e gravação, lendo o `error` de cada chamada (Art. 9).
- `src/qualidade-interface.jsx`: tela com abas pela URL (`useRouteTab`): **Resumo** (por módulo: telas, último teste automático, última revisão), **Checklist** (perguntas do módulo, registrar Ok/Falha/Não se aplica com observação), **Histórico** e **Perguntas** (só `administrar`).
- Rota `qualidade-interface` em `KNOWN_ROUTES`, item no menu em Administração, ramo em `app.jsx`. A rota entra sozinha no teste de fumaça. **Correção A6 aplicada:** o item do menu **não** leva `restrict: ["admin"]` (que bloquearia quem recebeu a alçada `revisar`); aparece por alçada `ver`. Antes de escrever, ler como o menu filtra por alçada (tarefa T014).
- A tela diz com todas as letras que o teste automático vem de um ambiente **sem dados** e cobre só parte do WCAG.

**Documentos (Art. 52):** nova tela **15.3 Qualidade de interface** no `15_administracao.md` (temas 15.3.1 a 15.3.11, Índice e Glossário reescritos, Art. 43), ajuda do "?", `01_geral.md` PC-11 (a pendência passa a apontar para 15.3), índice RAG. Esta spec migra para o documento do módulo ao final (Art. 38).

## 4. TASKS (pequenas, sequenciais, verificáveis)

**PR 1 — o teste**
- T001 Pedir "Confirmo" e instalar `@axe-core/playwright` (versão fixa) em `devDependencies`. *Verificável:* `npm ci` limpo; versão compatível com o Playwright 1.56.1.
- T002 Criar `e2e/acessibilidade.spec.js` e `e2e/acessibilidade-conhecidas.json`, em modo aviso, com as telas da 2.1. *Verificável:* rodar e ver as violações já conhecidas ficarem na lista; uma violação plantada de propósito aparecer como nova.
- T003 Criar `npm run a11y:relatorio` e gerar `src/qualidade-relatorio.json`. *Verificável:* arquivo gerado e legível pelo navegador em `/src/qualidade-relatorio.json`.
- T004 Rodar o spec 5 vezes seguidas (como o E2E já foi medido) e registrar flaky e tempo. *Verificável:* resultado escrito na spec.
- T005 Documentar (PC-11 do `01_geral.md`, `docs/rag`) e abrir o PR 1.
- T006 **Depois de 14 dias:** virar `A11Y_MODO=falha` no workflow (PR pequeno, com "Confirmo").

**PR 2 — o hub**
- T010 Descrever a migration e pedir "Confirmo"; aplicar; conferir RLS, grants, trigger e seed no banco real (Art. 31).
- T011 Alçadas no `CATALOGO_MODULOS` (`colaboradores-admin-store.js`) e `?v=`.
- T012 `qualidade-interface-calc.js` + teste de unidade (Art. 33).
- T013 `qualidade-interface-store.js` (erros explícitos).
- T014 `qualidade-interface.jsx`, rota, menu e `app.jsx`, com `?v=` novos.
- T015 **Abrir a tela de verdade** no navegador (resumo, registrar revisão com teste identificável "TESTE CLAUDE (excluir)" e apagar no fim, Art. 10, ver o histórico) e conferir com e sem alçada.
- T016 Documentos: 15.3, ajuda do "?", PC-11, `npm run rag`, `lint`, `test`, `check-cache-bust`.

## 5. Escopo que continua de fora
Corrigir violações achadas; leitor de tela, zoom e celular automatizados; renomear checks do CI.

## 6. ANALYZE — o que a auditoria desta spec achou

**A1. O servidor não serve `docs/`.** `server.js` só serve `src`, `styles`, `assets` e `TreinamentoVP`. Por isso o relatório do teste tem de morar em `src/`, não em `docs/`. *Conferido* no código (`PUBLIC_DIRS`).
**A2. O CI não consegue gerar o relatório sozinho.** A `main` é protegida e o repositório evita credencial no CI; o CI teria de fazer commit na `main`. Por isso o arquivo é gerado **localmente** (`npm run a11y:relatorio`) e commitado junto do PR, como o `docs/rag`. Isso **muda a redação da recomendação 2** ("o CI gera um arquivo"): o resultado da tela fica tão fresco quanto o último PR em que alguém rodou o script, e a tela mostra "gerado em <data> no commit <hash>". O CI só **compara** violações novas contra a lista.
**A3. O teste vê telas vazias.** O e2e usa Supabase simulado sem dados (`e2e/helpers.js`): tabelas preenchidas, modais e estados de erro **não são medidos**. A tela do hub e o relatório devem dizer isso.
**A4. Flakiness.** O axe pode variar com fonte e CDN. Antes de virar `falha`, medir 5 execuções seguidas (T004) e comparar por `(regra, alvo)`. No modo aviso não há risco.
**A5. Tempo do CI.** O E2E já leva cerca de 9 a 14 minutos e o teste de fumaça é o maior custo. Estimo +1 a 2 minutos com 11 telas, mas **não medi**; T004 mede.
**A6. Menu e delegação.** Hoje os itens de Administração têm `restrict: ["admin"]`. Se a revisão for delegada a quem não é administrador, o item não pode ter essa trava e deve aparecer por alçada (`ver`). Preciso ler como o menu filtra por alçada antes de decidir. *Não verificado.*
**A7. `/assinar` e Login.** `/assinar` pede token; sem token o teste mediria só a tela de erro. O Login (portal) não tem a tela do hub. Proposta: no PR 1 incluir só as telas que abrem sem token e deixar `/assinar` para um teste com token de teste, se for viável. *Não verificado.*
**A8. Compatibilidade da dependência.** O `@playwright/test` está fixo em 1.56.1 por causa do Chromium do ambiente. A versão do `@axe-core/playwright` precisa ser compatível. *Não verificado*; T001 confere.
**A9. Perguntas são minhas.** O checklist nasce como rascunho. Ele só vira regra depois da sua revisão (campo `rascunho`).
**A10. Constituição.** Sem conflito: sem bundler (Art. 18), tabela fechada (Art. 26), sem DELETE (Art. 27), erro explícito (Art. 9), aba na URL (Art. 22), teste junto do código (Art. 33), checks do CI intactos (Art. 36), documentos no mesmo PR (Art. 52).
**A11. Alçada de registrar sem dono definido.** Nasce só com Administrador; até o Gelson conceder, só ele revisa.
**A12. Número de telas.** *Corrigido em 08/11/2026:* o roteador tem **91 rotas conhecidas** (`KNOWN_ROUTES`, contadas por script), mais as páginas públicas. "Cerca de 100" era estimativa minha do `CLAUDE.md`.

## 7. Resultado do PR 1 (08/11/2026)
- **T001** dependência instalada (`@axe-core/playwright` 4.10.2, versão exata). Lock ganhou só 2 pacotes (`@axe-core/playwright`, `axe-core`). `npm audit` mostra 4 avisos de `vite`/`launch-editor` que **já existiam**; o job do CI usa `--omit=dev --audit-level=high` e não os conta.
- **T002** `e2e/acessibilidade.spec.js` e `e2e/acessibilidade-conhecidas.json`. 8 telas. Achou 10 violações graves, todas já conhecidas depois de listadas. **Achado novo:** `.gantt` no Dashboard (região rolável sem foco de teclado). **Prova do teste:** com a lista vazia e `A11Y_MODO=falha` a tela reprovou; restaurada a lista, nenhuma nova.
- **Descoberta no caminho:** o vídeo de abertura (`#vp-boot`) continuava na página e o axe media o contraste dele (2 falsos achados em toda tela). O teste espera ele sair e o exclui da medida.
- **T003** `npm run a11y:relatorio` grava `src/qualidade-relatorio.json` (8 telas, 10 violações, 0 novas).
- **T004** primeira bateria de 5 execuções: **4 delas tiveram teste instável** (o Dashboard estourava os 60 s). Ajustei o tempo para 120 s e limitei a espera de rede a 8 s. Segunda bateria: **5 de 5 com 8 passando, 0 instáveis, 126 a 145 s.** *(Medida na máquina local; o tempo no GitHub Actions não foi medido.)*
- **Correção do desenho:** a spec previa `formulario-cliente` e `/assinar`; ficaram de fora porque abrem só com token. Continua pendente decidir se vale um teste com token de teste.
- **Aberto:** T006 (virar `falha`) e todo o PR 2 (hub).

**Decisão pedida ao Gelson (Art. 37):** aplicar as correções A1, A2, A6 e A7 no desenho e começar pelo PR 1? Depois disso, cada passo sensível tem o seu "Confirmo" (T001 dependência, T010 migration).
