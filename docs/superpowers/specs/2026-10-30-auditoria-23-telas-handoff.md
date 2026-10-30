# Handoff — Auditoria técnica das 23 telas (Engenharia/Produto, Obras/Instalação, Entrega/Documentação, Parceiros/Instaladores)

> **Como usar este documento**: é um handoff de uma sessão do Claude Code para outra, porque a sessão anterior ficou sem tokens. Nada aqui foi corrigido — é **100% investigação já feita (read-only)** mais um **plano de execução enumerado**, do mais simples ao mais complexo. A nova sessão deve: (1) ler este arquivo inteiro (a investigação dos 4 módulos / 23 telas está **completa** — os 4 anexos A-D têm relatório cheio), (2) ler o `CLAUDE.md` da raiz do repo (é a "constituição" do projeto — método de trabalho, áreas blindadas, regra de cache-busting, fluxo de git), (3) começar a executar as tarefas numeradas, na ordem, **parando para confirmar com o usuário em qualquer item marcado "⚠️ EXIGE DECISÃO DO USUÁRIO"** antes de codar.

## Origem

Pedido original do usuário (ver `01_SPECIFY.md` a `06_IMPLEMENT.md` da tarefa) era uma varredura técnica **read-only** nas 23 telas de 4 módulos:
- **Engenharia & Produto** (8 telas)
- **Obras & Instalação** (6 telas)
- **Entrega & Documentação** (4 telas)
- **Parceiros & Instaladores** (5 telas)

A investigação foi feita por 4 agentes em paralelo, um por módulo. **Os 4 terminaram** (Engenharia & Produto, Entrega & Documentação, Parceiros & Instaladores, Obras & Instalação) — ver Anexos A, C, D e B, respectivamente, todos completos.

## Regras que valem para TUDO que for feito a partir daqui (resumo do CLAUDE.md — leia o arquivo inteiro antes de mexer em qualquer coisa)

1. **Método obrigatório para qualquer mudança de produto/estrutura**: SPECIFY → CLARIFY → PLAN → TASKS → ANALYZE → IMPLEMENT. O `CLAUDE.md` do repo é a "constituição" (regras permanentes). Specs de trabalho novo vão em `docs/superpowers/specs/<data>-<assunto>.md` — um arquivo por assunto. Não implementar antes de alinhar Specify/Clarify com o usuário. Correção pequena e óbvia (ex. texto errado, `onClick` faltando) não precisa do ciclo inteiro, mas qualquer coisa que mexa em modelo de dado, banco ou decisão de produto, precisa.
2. **Áreas blindadas — não mexer sem pedir confirmação explícita antes de editar** (procure a seção "🔒 ÁREA BLINDADA" no `CLAUDE.md`): Sistema de E-mail/Inbox (`send-email`, `read-inbox`, vínculo, soft-delete), botão "Ver documento" da Central de Decisões, Preço de Containers × Atualização de Custos, Mão de obra × quantidade > 1 / Trocar-Remover-Acrescentar equipamento, Assinatura digital (motivo/recusa, signatários). **Nenhum achado desta auditoria pede para mexer direto nessas áreas**, mas se alguma tarefa abaixo esbarrar nelas, pare e pergunte antes.
3. **Trava por "Confirmo"**: as 5 abas de Cadastros › Atualização de Custos (`cadastro-custos.jsx`/`-store.js`/`difal-engine.js`) e as 6 tabelas de custo no Supabase só podem ser alteradas depois que o usuário escrever literalmente "Confirmo" no chat, descrevendo antes o que vai mudar. Nenhum achado desta auditoria toca nelas, mas vale saber.
4. **Cache-busting**: todo `<script src="...?v=N">` em `index.html` (e também `assinar.html`, `formulario-cliente.html`, `cotacao-elevador-fornecedor.html`, `recibo-instalador.html` quando aplicável) precisa ter o `?v=` incrementado **no mesmo commit** que editar o arquivo `.js`/`.jsx`/`.css` referenciado. O CI roda `node scripts/check-cache-bust.js origin/main` e barra PR sem isso — rode esse comando localmente antes de abrir PR.
5. **Fluxo de git**: criar branch a partir de `origin/main`, commitar, abrir PR, e só fazer squash merge em `main` quando o usuário pedir explicitamente ("abra o PR e faça o merge"). Documentar entregas relevantes como issue fechada no GitHub (criar com `state: closed` no create às vezes não fecha de verdade — confirme com `issue_read` depois e force um `update` se precisar).
6. **Teste real**: sempre que possível, `npm test` + validar sintaxe (Babel/`node --check`) antes de considerar algo pronto. Testar clique real no navegador (Playwright) quando o ambiente permitir — documentar no CLAUDE.md quando não foi possível.
7. **Nada de abstração especulativa**: corrigir só o que foi pedido/achado, sem redesenhar telas vizinhas "por tabela".
8. **Qualquer gravação de teste em produção** (Supabase real) precisa ser claramente identificável (ex. `"TESTE CLAUDE (excluir)"`) e apagada no final.

---

## Investigação de "Obras & Instalação" — ✅ CONCLUÍDA (ver Anexo B)

A auditoria read-only das 6 telas de **Obras & Instalação** já foi concluída e está completa no Anexo B, ao fim deste arquivo. Confirmou, entre outras coisas, exatamente a suspeita de que `dossier_obra.codigo_obra` (coluna criada em 29/10/2026 "pra poder ser citada numa ART futura") **não é usado em lugar nenhum da tela `art`** — a única tela que já usa esse campo corretamente é "Instalação em Campo" (ver Anexo A, nota da tela 2, e Anexo B, telas 1 e 4-6).

---

## Plano de execução — do mais simples ao mais complexo

Numeração única (1 a 30) cobrindo os 3 módulos já investigados. Adicione os achados de Obras & Instalação (Tarefa 0) nesta mesma lista, continuando a numeração a partir de 31, mantendo o critério de ordenação por complexidade.

### Nível 1 — Cosmético / texto (sem risco, sem lógica nova)

**1.** `shell.jsx` — `BREADCRUMB_MAP.cronograma.page` ainda diz `"Cronograma de Instalação"` (nome antigo); o rótulo do menu e o `<h1>` dentro de `entrega.jsx` (`CronogramaPage`) já dizem `"Cronograma de Pagamento da Instalação"` (renomeado no PR #1135, documentado no CLAUDE.md). Atualizar o breadcrumb para bater. *(Anexo D, achado transversal)*

**2.** `operacoes.jsx` (`EngenhariaPage`, rota `engenharia`) — menu lateral e `BREADCRUMB_MAP` dizem "Engenharia", mas o `<h1>` real e o `document.title` dizem "Projetos de Engenharia". Decidir um nome e alinhar os 3 lugares. *(Anexo A, tela 1)*

**3.** `ncm-catalogo.jsx` (rota `ncm-catalogo`, label de menu "Catálogo Siscomex") — 4 nomes divergentes para a mesma rota: menu "Catálogo Siscomex", breadcrumb módulo/página "Cadastros"/"Produtos", `document.title` "Catálogo de Produtos", `<h1>` "Catálogo de Produtos" com eyebrow "Cadastros · Produtos". Pior: esse breadcrumb colide textualmente com a rota **diferente** `cadastro-produtos` (menu "Produtos", grupo Fabricação, breadcrumb "Fabricação/Produtos") — são duas telas/tabelas totalmente distintas (`catalogo_produtos` vs `pcp_produtos`). Decidir um nome único para `ncm-catalogo` que não colida com `cadastro-produtos` e alinhar sidebar/breadcrumb/title/h1. *(Anexo A, tela 7)*

**4.** `src/desenho-tecnico.jsx` (rota `desenho-tecnico`) — menu diz "Projetos ER/Es", mas breadcrumb/title/h1 dizem "Desenho Técnico ER | ES". Alinhar nome. *(Anexo A, tela 4)*

**5.** `src/handover-manutencao.jsx` (rota `handover`, menu "Entrega Final") — 4 nomes diferentes na mesma tela: rótulo de menu "Entrega Final", `<h1>` interno "Handover & Manutenção", eyebrow "Instalação & Entrega · Pós-venda", `BREADCRUMB_MAP.page` "Handover & Pós-venda". É a pior inconsistência de nome encontrada. ⚠️ **Antes de mexer, decidir com o usuário qual é o nome canônico** (pode ser só "Entrega Final" em todo lugar, ou formalizar "Handover" como termo técnico interno aceito — ambos são válidos, é decisão de produto, não técnica). *(Anexo C, tela "Entrega Final")*

**6.** `BREADCRUMB_MAP` usa `module = "Instalação & Entrega"` em pelo menos **6 rotas diferentes** — essa string **não existe mais** como label de nenhum grupo em `NAV_GROUPS` (hoje são "Obras & Instalação" e "Entrega & Documentação"); é resíduo de uma reorganização de menu anterior nunca atualizada. Confirmado nas rotas: `databook`, `handover` (Anexo C), `cronograma` (Anexo D), `vistorias-envio`, `mapa-obras`, `art` (Anexo B). Ao corrigir, dividir corretamente entre os 2 módulos reais conforme o grupo de menu de cada rota hoje (`databook`/`handover`/`central-documentos` → "Entrega & Documentação"; `cronograma` → "Parceiros & Instaladores"; `vistorias-envio`/`mapa-obras`/`art`/`status-obras`/`instalacao`/`vistorias` → "Obras & Instalação"). Essa é uma correção única, de baixo risco, que resolve de uma vez boa parte dos achados de "ambiguidade de nome/módulo" espalhados pelos 4 anexos — vale fazer antes das demais tarefas de Nível 1, por efeito multiplicador.

**7.** `central-documentos.jsx` — a tela não usa o padrão visual `page-head`/`<h1 className="page-head__title">` como as outras 3 do mesmo grupo de menu; o título "📁 Central de Documentos" é uma `div` solta na coluna lateral. Padronizar visualmente com as irmãs (`databook`/`handover`/`repositorio-documentos`). *(Anexo C, tela 1)*

**8.** `ncm-catalogo.jsx` — `ModalProdutoCatalogo`/`ModalOperadorEstrangeiro` sugerem CNPJ raiz padrão `"54123456"`, que não bate com o CNPJ real da VerticalParts (`15.822.325/0001-27`, raiz `15822325`) documentado no CLAUDE.md — parece placeholder de scaffold nunca corrigido. Como o modal está morto (ver tarefa 25), avaliar se corrige o placeholder ou remove o código junto. *(Anexo A, tela 7)*

### Nível 2 — Correções funcionais pequenas e isoladas (baixo risco)

**9.** `src/entrega.jsx` (`CronogramaPage`, rota `cronograma`) — o botão "Abrir" de cada linha da lista (`<Button ... title="Abrir">Abrir</Button>`) **não tem `onClick`**; é decorativo. A linha inteira já tem `onClick={() => setSel(r)}`, então o botão nunca precisa ser clicado para funcionar — mas enquanto existir visualmente sem ação, é um stub real. Ou dar o mesmo handler ao botão, ou removê-lo (já que clicar na linha funciona). *(Anexo D, tela 5)*

**10.** `pagamentos-instalador.jsx` — não existe link de uma linha de parcela para o Contrato Instalador correspondente (`contrato.numero_documento` aparece só como texto). Adicionar navegação (`setSubsel`+`setRoute` para `contrato-instalador`, nunca `VpRouter.navigate` isolado — ver regra do CLAUDE.md sobre isso). *(Anexo D, tela 4)*

**11.** `rh-homologacao-store.js` (`salvarMontador`, usado por `cadastro-instaladores.jsx` via `ModalNovoMontador`) — toda edição do cadastro de uma empresa instaladora grava `certificacoes: f.certificacoes || {}`, **zerando silenciosamente** a coluna `parceiros_instaladores.certificacoes` a cada save, porque o formulário nunca inicializa nem edita esse campo. O próprio código já documenta esse campo como obsoleto (ninguém mais lê dele desde a migração para o catálogo de documentos por colaborador) — confirmado por grep que `validarCertificacoes`/`statusGeral`/`statusVariant`/`CERTIFICACOES` não são chamados em lugar nenhum do projeto. **Correção simples**: parar de escrever esse campo no `update` (não precisa migration — é só remover a linha de código que grava `{}` por cima do valor antigo). Opcional/mais tarde: dropar a coluna de vez, mas isso é decisão de banco, não urgente. *(Anexo D, tela 1)*

**12.** `central-documentos.jsx` — a tela não existe em `CATALOGO_MODULOS` nem em `MODULOS_POR_GRUPO_SIDEBAR` (`src/colaboradores-admin-store.js`), diferente dos outros 3 irmãos do grupo (`databook`, `handover`, `repositorio-documentos`), que têm entrada própria. Consequência: não dá para conceder/restringir essa tela em Administração › Alçadas, e o componente nunca chama `temCapacidade(...)` nem para VER a tela nem para o único botão de escrita que ela tem (marcar "documentação do instalador enviada"). Adicionar entrada no catálogo de módulos e a checagem de alçada correspondente, seguindo o padrão já usado em `repositorio-documentos.jsx` (`temCapacidade('repositorio-documentos','criar'/'excluir')`). *(Anexo C, tela 1)*

**13.** `BREADCRUMB_MAP['central-documentos'].module` hoje é `"Engenharia"`, mas o item está no grupo de menu "Entrega & Documentação" junto com `databook`/`handover` (cujo `module` é o legado "Instalação & Entrega", ver tarefa 6). Alinhar o `module` de `central-documentos` com os 3 irmãos do grupo (depois de decidir, na tarefa 6, qual é o nome de módulo correto para o grupo inteiro). *(Anexo C, tela 1)*

**14.** `solicitacoes-produto-store.js` — e-mails de notificação (`EMAIL_ENGENHARIA_RESPONSAVEL`/`EMAIL_IMPORTACAO_RESPONSAVEL`) estão hardcoded no JS; já exigiu deploy manual ao trocar de pessoa (16/10/2026, segundo o próprio histórico do CLAUDE.md). Mover para uma fonte configurável (ex. tabela de configuração, ou reaproveitar o sistema de "líder de departamento" que outras partes do projeto já usam, como `colaboradores_vpsistema.is_department_lead`). ⚠️ Antes de implementar, confirmar com o usuário qual é a fonte certa de "responsável por Engenharia/Importação" hoje. *(Anexo A, tela 5)*

### Nível 3 — Navegação / deep-link / suporte a F5 (padrão já estabelecido no projeto, só falta aplicar)

O projeto já tem um padrão consolidado para isso (`src/rota-pcp.js`: `window.useRotaId(rota)`, `window.useRotaItem(rota, aba)`, `window.useRouteTab(rota, padrao, abasValidas)`), usado com sucesso em dezenas de telas (ver seção "Varredura de URLs" no CLAUDE.md, 09/10/2026). As tarefas abaixo são aplicar esse MESMO padrão onde falta — baixo risco técnico, mas exige teste cuidadoso de cada tela depois.

**15.** `cadastro-instaladores.jsx` — tem um deep-link parcial (lê a URL manualmente uma vez no mount via `useEffect`), mas **não assina `VpRouter.subscribe`/evento `vp:navigate`**. Resultado: o link direto funciona na 1ª carga, mas Voltar/Avançar do navegador entre duas empresas diferentes clicadas na mesma sessão não reabre a empresa certa. Trocar pelo padrão `useRotaId('cadastro-instaladores')`. *(Anexo D, tela 1)*

**16.** `rh-homologacao.jsx` — zero integração com o roteador (nenhuma referência a `window.VpRouter` no arquivo inteiro); empresa/colaborador/documento selecionados vivem só em `useState`. F5 ou link direto sempre cai na lista vazia. Adicionar `useRotaId`/`useRouteTab` pelo menos para a empresa selecionada (o documento aberto em modal pode ficar de fora, como outros modais efêmeros já documentados no CLAUDE.md). *(Anexo D, tela 2)*

**17.** `handover-manutencao.jsx` — seleção de projeto/dossiê é só `useState`; F5 ou link direto sempre volta à lista vazia, mesmo sendo um registro real e concreto (diferente dos casos "de baixo valor" já aceitos no CLAUDE.md). Adicionar `useRotaId('handover')`. *(Anexo C, tela "Entrega Final")*

**18.** `engenharia-config.jsx` (rota `eng-configurador`) — lista e edição vivem só em `useState`, sem `useRouteTab`/`useRotaId`; F5 sempre volta à lista. Adicionar o padrão. *(Anexo A, tela 3)*

**19.** `solicitacoes-produto.jsx` — a navegação pós-conversão para Ficha Técnica usa `VpRouter.navigate` + `dispatchEvent(new PopStateEvent(...))` manual, uma 2ª convenção de navegação diferente da documentada no CLAUDE.md (`setRoute`/`setSubsel` vindos de props do `App`). Funciona, mas é inconsistente. Padronizar (a tela provavelmente precisa passar a receber `setRoute`/`setSubsel` como prop em `app.jsx`, como as demais telas do padrão). *(Anexo A, tela 5)*

### Nível 4 — Correções de dado/lógica que tocam gates ou conexões cruzadas (exigem mais cuidado, ainda sem mudança de modelo de dados)

**20.** `project-gates.js` (`validarGatesImportacao`, usado pela aba "Gatilhos Importação" da tela `engenharia`/`operacoes.jsx`) — os 3 gates são **estruturalmente inalcançáveis**: (a) `equipamentos_spec.project_id` nunca é escrito por `engenharia-config.jsx` (`save()` não grava esse campo); (b) `contratos_venda_equipamentos.project_id` só é escrito pelo editor jurídico LEGADO (`contrato-editor.jsx`), nunca pelo fluxo moderno (`contrato-venda-store.js`, que usa `numero_cotacao`/`proposta_id`); (c) a consulta a `instalacao_cronograma.endereco` tem comentário do próprio autor admitindo incerteza de schema. A UI mostra "✅/⏳" mas nunca fecha pelo caminho real. ⚠️ **EXIGE DECISÃO DO USUÁRIO**: reescrever os 3 gates para usar as fontes vivas (`numero_cotacao`/`dossier_obra`/`proposta_id`), ou remover a aba/funcionalidade morta de vez. *(Anexo A, tela 1 — um dos 3 achados mais graves apontados pelo agente)*

**21.** `ncm-catalogo.jsx` — a coluna de kanban "Cadastrado Siscomex" ("Produto ATIVO disponível para Duimp") só faz `update status` em `ncm_solicitacoes`; **não cria nem vincula nada em `catalogo_produtos`**. Mover o card é uma afirmação textual sem efeito real no catálogo de verdade. ⚠️ **EXIGE DECISÃO DO USUÁRIO**: criar o vínculo real (ex. ao mover para essa coluna, criar/vincular a linha em `catalogo_produtos`), ou só ajustar o texto do kanban para deixar claro que é um rastreador de processo manual, sem efeito automático. *(Anexo A, tela 7)*

**22.** `src/dossier-obra.jsx` (Dossiê da Obra) não tem NENHUMA referência a "Handover" (confirmado por grep), mesmo `handover-manutencao.jsx` lendo/escrevendo a mesma linha de `dossier_obra` (coluna jsonb `handover`). Quem está no Dossiê não descobre que existe um Handover pendente/registrado para aquela obra sem navegar manualmente até o menu "Entrega Final". Adicionar um link/indicador cruzado dentro do Dossiê (ex. selo "Handover: pendente/concluído" com link para a tela). *(Anexo C, tela "Entrega Final")*

**23.** `handover-manutencao.js` — o item de checklist `databook_assinado` ("Data Book assinado pelo cliente") é só uma caixinha marcável à parte, **sem nenhum vínculo** com o arquivo real de Data Book anexado via `dossier_documentos` (Central de Documentos/Dossiê). ⚠️ **EXIGE DECISÃO DO USUÁRIO**: ligar o checkbox à existência real do arquivo (ex. só marcável quando há um documento tipo "DataBook" anexado no dossiê), ou manter como está mas deixar explícito na UI que é um controle manual independente do arquivo. *(Anexo C, tela "Entrega Final")*

**24.** `cadastro-instaladores.jsx` mostra 3 métricas por empresa (Funcionários, Elevadores, Pagamentos) mas **nenhum indicador de homologação/compliance** (vencido/válido) — isso só existe na tela separada `rh-homologacao.jsx`. As duas telas se descrevem mutuamente em comentários de código, mas não há badge cruzado nem link direto de uma para a outra além de texto estático. ⚠️ **EXIGE DECISÃO DO USUÁRIO**: adicionar um badge de compliance no card da empresa (ex. "⚠ 2 docs vencidos") com link para a Homologação, ou deixar como separação intencional de responsabilidade entre as duas telas. *(Anexo D, telas 1 e 2)*

### Nível 5 — Consolidação de fontes de verdade conflitantes (dado real, não só UI — maior risco, precisa de decisão de produto antes de qualquer linha de código)

**25.** ⚠️ **EXIGE DECISÃO DO USUÁRIO — NÃO IMPLEMENTAR SEM SPECIFY/CLARIFY**. `ncm-catalogo.jsx` tem um modal de cadastro manual de produto (`ModalProdutoCatalogo`) com **código morto confirmado**: `setShowProd(true)` nunca é chamado em lugar nenhum do arquivo (o botão que abria foi removido da UI, substituído pelo texto "📋 Produtos vêm da Ficha Técnica"), mas as ~100 linhas do modal continuam no bundle, renderizadas condicionalmente, **inalcançáveis**. Ao mesmo tempo, `catalogo_produtos` já é escrito automaticamente por `ficha-tecnica.jsx` (`syncCatalogoProduto`, gera id sintético `'ft-'+ficha.id`) toda vez que uma Ficha Técnica é salva. Ou seja: existe uma 2ª via de escrita em `catalogo_produtos` com formato de id diferente, hoje desligada só por um botão ausente — basta alguém adicionar o botão de volta (ou reabilitar `showProd` em qualquer refactor futuro) para reabrir uma via de dados divergente. **Decisão**: remover o modal morto de vez (recomendado, já que Ficha Técnica é confirmada como a fonte real), ou formalizar como caminho alternativo com regra clara de quando usar cada um. *(Anexo A, telas 6 e 7)*

**26.** ⚠️ **EXIGE DECISÃO DO USUÁRIO — NÃO IMPLEMENTAR SEM SPECIFY/CLARIFY**. Existem **3 repositórios de arquivo concorrentes**, sem relação entre si, para o mesmo papel mental do usuário ("onde eu guardo um documento importante desta obra/cotação?"):
   - `dossier_documentos` (lido/mostrado em "Central de Documentos", por obra — ART/Termo de Vistoria/DataBook/Termo de Entrega/Alvará/etc.)
   - `repositorio_documentos` (tela "Repositório Documentos", upload genérico, sem vínculo com cliente/obra/cotação)
   - `projetos_elevador_desenhos` (aba "Desenhos" de "Projeto de Elevadores", repositório pensado para enviar ao cliente, por cotação)

   Nenhuma das 3 UIs orienta o usuário sobre qual usar quando um documento poderia se encaixar em mais de uma categoria. **ATENÇÃO HISTÓRICA**: uma sessão anterior já tentou "consolidar" 3 telas parecidas (Central de Documentos/Data Book/Entrega Final) num wrapper comum sem perguntar o propósito, e isso foi corretamente revertido pelo usuário (ver CLAUDE.md, seção "Entrega & Documentação — 'Repositório Documentos' é tela NOVA, independente das outras 3"). **NÃO REPITA ESSE ERRO.** A tarefa aqui não é fundir nada — é, no mínimo, perguntar ao usuário se ele quer (a) só uma orientação textual mais clara em cada tela sobre quando usar qual, ou (b) algo mais estrutural, e só então agir. *(Anexo C, telas 1 e 4; reforçado pelo Anexo A, tela 2)*

**27.** ⚠️ **EXIGE DECISÃO DO USUÁRIO — NÃO IMPLEMENTAR SEM SPECIFY/CLARIFY**. Existem **3 fontes independentes e não reconciliadas de "pagamento ao instalador"**:
   - `contrato_instalador_parcelas` — fonte "oficial", liberação automática pelo Diário de Obra + aprovação do Gestor Comercial, é o que `pagamentos-instalador.jsx` lê e o que trava o status "assinado" do contrato.
   - `omie_pagamentos_cache` — reconciliação com Contas a Pagar do Omie, casada por `dossier_id`, mostrada em "Empresas Instaladoras".
   - Modelo "4 fases por marco físico" (Início/Tracionado/Portas+elétrica/Conclusão) dentro de `instalacao_cronograma` (tela "Cronograma de Pagamento da Instalação") — campos "Montador"/"Endereço" são **texto livre**, sem FK para `parceiros_instaladores` nem `dossier_obra`/`numero_cotacao`.

   Nenhuma das 3 telas mostra ou avisa se as fontes divergem entre si para o mesmo instalador/obra. O único consumidor externo de `instalacao_cronograma` (`project-gates.js`) já foi confirmado inalcançável (tarefa 20), então na prática o modelo de "4 fases" está isolado do resto do sistema. **Decisão**: (a) aposentar o Cronograma de 4 fases e usar só `contrato_instalador_parcelas` como fonte de verdade de pagamento, reformulando a tela `cronograma` para refletir dados reais; ou (b) reconstruir `instalacao_cronograma` com FKs de verdade (`parceiro_instalador_id`, `dossier_id`) e reconciliar com `contrato_instalador_parcelas`. *(Anexo D, telas 1, 4 e 5)*

**28.** ⚠️ **EXIGE DECISÃO DO USUÁRIO — NÃO IMPLEMENTAR SEM SPECIFY/CLARIFY**. `src/entrega.jsx` (`CronogramaPage`, rota `cronograma`) está isolada do pipeline real de dados: campos "Montador" e "Endereço" são `<input>` de texto livre, sem autocomplete/FK contra `parceiros_instaladores` nem `dossier_obra`. Botão "Abrir" sem ação (ver tarefa 9, mas o problema de fundo é maior que o botão). O único consumidor externo (`project-gates.js`, tarefa 20) também está confirmado morto. Isto é consequência direta da tarefa 27 — tratar as duas juntas na mesma decisão com o usuário. *(Anexo D, tela 5)*

**29.** ⚠️ **EXIGE DECISÃO DO USUÁRIO — NÃO IMPLEMENTAR SEM SPECIFY/CLARIFY**. `eng-configurador` ("Projeto de Equipamento", `engenharia-config.jsx`, tabela `equipamentos_spec`) e `desenho-tecnico` ("Projetos ER/Es", `desenho-tecnico.jsx`, **sem tabela nenhuma, 100% client-side**) resolvem o MESMO problema de negócio — configurar escada/esteira rolante (ângulo, rise, largura, velocidade, motorização) — com modelos de dado incompatíveis, SKUs em formatos diferentes (um deles usa um padrão próprio tipo `VP-ER-30-1000-04500-DD220-STB-GLS-S050`, incompatível com o padrão `VPxx-NNNN` do resto do sistema), e sem nenhum link cruzado entre as duas telas. `desenho-tecnico.jsx` em particular parece um artefato de demonstração (confirmado: zero chamadas ao Supabase em 418 linhas; "Solicitar orçamento" é só um toast; "Exportar ficha" é só `window.print()`). **Decisão**: (a) aposentar `desenho-tecnico` do menu, ou (b) decidir qual das duas é a fonte de verdade e migrar/ligar a outra a ela, ou (c) formalizar por que as duas coexistem (ex. uma é configurador técnico interno, outra é vitrine comercial) e documentar isso claramente na UI e no CLAUDE.md. *(Anexo A, telas 3 e 4 — achado "mais grave" apontado pelo agente, junto com a tarefa 20)*

**30.** ⚠️ **EXIGE DECISÃO DO USUÁRIO — NÃO IMPLEMENTAR SEM SPECIFY/CLARIFY**. Tabela `projetos` (usada pelo hub "Engenharia", `operacoes.jsx`, via `ModalNovoProjeto`) é a **mesma classe de tabela "mock-era"** já migrada com sucesso em outra tela do sistema: "Instalação em Campo" trocou `equipes`/`projetos` (vazias em produção) por `dossier_obra`/`equipamentos_obra` em 29/10/2026 (ver CLAUDE.md, PR #1138). O hub "Engenharia" continua escrevendo em `projetos`, sem `numero_cotacao`/`dossier_obra`/`master_id`. **Decisão**: migrar o hub "Engenharia" para o modelo real também (reaproveitando o aprendizado documentado da migração de Instalação em Campo), ou decidir que esse hub tem um propósito genuinamente diferente (ex. rascunho pré-cotação) e documentar isso. Essa decisão também destrava a tarefa 20 (os gates de `project-gates.js` fariam mais sentido se `projetos`/`equipamentos_spec` ganhassem uma FK real para `dossier_obra`/`numero_cotacao`). *(Anexo A, tela 1)*

### Tarefas do módulo "Obras & Instalação" (Anexo B) — 31 a 41

**31.** (Nível 1) `src/entrega.jsx` (`ArtPage`, rota `art`) — eyebrow interno diz "Instalação & Entrega · ART", internamente consistente com o `BREADCRUMB_MAP` legado (ver tarefa 6), mas ainda assim desalinhado do grupo de menu real ("Obras & Instalação"). Resolvido junto com a tarefa 6.

**32.** (Nível 1) `src/vistorias-envio.jsx` — comentário de cabeçalho (linhas 14-16) afirma que "a página pública de execução no celular ainda não foi construída". Isso é **falso hoje**: `vistoria-execucao.html`/`.jsx` (v9) existe, tem rota real (`server.js`, `/vistoria/:token`) e funciona de ponta a ponta. Corrigir/remover o comentário desatualizado para não confundir a próxima pessoa que ler o arquivo.

**33.** (Nível 1) `src/vistorias-obras.jsx` (rota `vistorias`) — usa classes CSS próprias (`page-header`) em vez do padrão `page-head`/`page-head__eyebrow` usado pelas outras 5 telas do módulo. Puramente cosmético/consistência visual — alinhar ao padrão quando for mexer na tela por outro motivo (não vale um PR só para isso).

**34.** (Nível 2) `src/dossier-obra.jsx` (`ObrasStatusPage`, rota `status-obras`) — o rótulo do menu já foi trocado para "Dossiês de Obras" (comentário no próprio `shell.jsx` cita isso como "Achado 01 de uma auditoria" anterior), mas **nada dentro da tela acompanhou**: `<h1>` continua "Status de Obras", eyebrow continua "Engenharia · Status de Obras". Atualizar h1/eyebrow para "Dossiês de Obras" (faz parte do mesmo pacote da tarefa 6, mas aqui o texto interno da própria tela também precisa mudar, não só o `BREADCRUMB_MAP`).

**35.** (Nível 2) `src/dossier-obra.jsx` — **bug de navegação real, não só cosmético**: como `BREADCRUMB_MAP["status-obras"].module` é "Engenharia" (errado — ver tarefas 6/34), o segmento clicável do breadcrumb no topo da página leva, de verdade, para a rota `engenharia` (`MODULE_HOME["Engenharia"] = "engenharia"`), a tela legada "Projetos de Engenharia" (`operacoes.jsx`, sobre laudos/visitas, tabela `projetos`) — **sem nenhuma relação com Dossiês de Obras**. É um link real, clicável, levando a lugar errado. Corrigir junto com a tarefa 6/34 (ajustar `module` resolve isso automaticamente, já que o breadcrumb lê `MODULE_HOME[bc.module]`).

**36.** (Nível 2) `src/vistorias-envio.jsx` (`veVpobLabel()`) — reimplementa à mão a fórmula `'VPOB-' + padStart(numero_cotacao,4,'0')`, que já existe centralizada em `window.MasterIdEngine.etapaId('obra', ...)` (usada por `dossier-obra.jsx`). Trocar pela chamada ao helper compartilhado, nos 3 pontos onde `veVpobLabel()` é usado (linhas 609, 868, 1067 do arquivo).

**37.** (Nível 2) `src/dossier-obra.jsx` — `window.MasterIdEngine.etapaId('obra', ...)` é chamado 3 vezes literalmente no mesmo arquivo (linhas 57, 107, 361) em vez de calculado uma vez e reaproveitado. Limpeza simples, sem risco.

**38.** (Nível 2) `src/mapa-obras.jsx` — as chamadas à API pública do Nominatim (geocodificação) não enviam nenhum header `User-Agent`/`Referer` identificando a aplicação, algo que a própria política de uso do Nominatim recomenda para não arriscar bloqueio por IP. Adicionar um header simples de identificação nas 2 chamadas fetch (linhas ~39 e ~60). Baixo risco, correção isolada.

**39.** (Nível 2, verificação antes de corrigir) `index.html` carrega `distancia-obra.js` **depois** de `mapa-obras.jsx` na ordem dos `<script>` (linha 416 vs 278), mas `mapa-obras.jsx` chama `window.DistanciaObra` em tempo de execução (linha 66). O agente não conseguiu confirmar se isso causa falha real (os scripts deste projeto costumam terminar de carregar antes do primeiro render React) — **antes de reordenar os `<script>`, testar no navegador se `window.DistanciaObra` já existe quando `mapa-obras.jsx` executa**; só reordenar se de fato houver falha observável.

**40.** (Nível 3, deep-link/F5 — mesmo padrão das tarefas 15-19) Aplicar `useRotaId`/`useRouteTab` onde falta neste módulo: `dossier-obra.jsx` (filtros `statusFiltro`/`busca` são só `useState`, não refletem na URL), `operacoes.jsx`/`InstalacaoPage` (busca e accordion `abertos` só `useState`), `mapa-obras.jsx` (filtros da aba Mapa e da aba Evolução só `useState`). Risco baixo, mas são 3 pontos de correção, não 1 — tratar como 3 sub-tarefas se for mais prático dividir o trabalho.

**41.** ⚠️ **Nível 4/5 — EXIGE DECISÃO DO USUÁRIO, achado mais importante de todo o Anexo B.** Existem hoje **3 implementações independentes do "Número da Obra" para a mesma entidade, com prefixos e valores DIFERENTES para a mesma cotação**:
   - `dossier-obra.jsx` (tela "Dossiês de Obras") calcula ao vivo `window.MasterIdEngine.etapaId('obra', numero_cotacao)` → prefixo **`VPOB-`** (ex. `VPOB-0955`), nunca persistido.
   - `vistorias-envio.jsx` reimplementa a mesma fórmula à mão (`veVpobLabel()`, mesmo prefixo `VPOB-`) — resolvido junto pela tarefa 36, mas o VALOR final ainda é `VPOB-`.
   - `dossier_obra.codigo_obra` (coluna persistida em 29/10/2026, migration `20261029150000_dossier_obra_codigo_obra.sql`, pensada "pra poder ser citada numa ART futura") usa prefixo **`VPNI-`** (o mesmo do Contrato do Instalador) — é o valor que a tela "Instalação em Campo" de fato mostra.

   Ou seja: a MESMA obra (ex. cotação 955) aparece como `VPOB-0955` em "Dossiês de Obras"/"Vistorias de Obras" e como `VPNI-0955` em "Instalação em Campo" — nenhuma das duas telas lê a coluna persistida da outra. Além disso, a tela `art` não usa nenhum dos dois (não tem campo de registro de ART vinculado à obra), apesar de `codigo_obra` ter sido criado explicitamente com esse propósito. **Decisão necessária**: escolher UM identificador canônico de obra (o candidato óbvio é `dossier_obra.codigo_obra`, já persistido e pensado para isso) e migrar `dossier-obra.jsx`/`vistorias-envio.jsx` para usá-lo em vez de recalcular `VPOB-` ao vivo; e, só depois dessa decisão, avaliar se vale dar à tela `art` um campo real para registrar o número da ART emitida, vinculado a `codigo_obra` (hoje a tela é só orientação estática, redirect intencional para o Dossiê — ver próximo item). *(Anexo B, telas 1, 2, 4 e 6)*

**42.** (Nível 1, baixo valor mas útil registrar) 4 queries ad-hoc e independentes de `dossier_obra`+`equipamentos_obra` (em `dossier-obra.jsx`, `vistorias-obras.jsx`, `mapa-obras.jsx`, `instalacao-campo-store.js`), cada uma com seu próprio shape/filtro, sem um hook/store único de "lista de obras". Não é urgente — citar como oportunidade de refactor futuro, não como bug a corrigir agora (nenhuma das 4 tem comportamento incorreto, só código repetido).

**Pontos POSITIVOS confirmados no Anexo B, para referência de padrão (não geram tarefa)**: `vistorias-obras.jsx` já teve sua duplicação de tabelas de vistoria resolvida de verdade (confirmado por grep: zero referência viva a `vistorias_obras` no `src/`, só 2 comentários explicando a remoção feita em 12/10/2026) — é a tela mais limpa do módulo. `instalacao.jsx`/`operacoes.jsx` (rota `instalacao`) já teve o código morto `equipes`/`projetos`/`ModalAgendarInstalacao`/`EquipeChecklist` removido de verdade (confirmado por grep) e é a ÚNICA tela do sistema que usa `dossier_obra.codigo_obra` corretamente. `mapa-obras.jsx` já tem rate-limit real para o Nominatim (1100ms entre chamadas) — a hipótese anterior de "sem trava" não se confirmou.

---

## Observações gerais (não viram tarefa, mas são úteis para quem for ler o relatório final)

- As telas **mais bem construídas** encontradas na auditoria (para usar como referência de padrão ao corrigir as demais): `linha-do-tempo.jsx` (Anexo A — "tela mais conectada das 8", agrega 7+ fontes por `numero_cotacao`, zero achados negativos), `engenharia-elevador.jsx`/aba Especificação (Anexo A — deep-link completo, eventos reais, aval de engenharia), `contrato-instalador.jsx` (Anexo D — deep-link completo via `useRotaItem`/`useRouteTab`, nenhum stub, histórico de correções já maduro), `repositorio-documentos.jsx` (Anexo C — RLS fechada desde o nascimento, `temCapacidade` correto, padrão visual consistente).
- Padrão recorrente em quase todos os achados de Nível 3: a ausência de `useRotaId`/`useRouteTab` é sempre o MESMO tipo de correção (baixo risco, mecânica), só repetida em telas diferentes que não receberam a varredura de URLs de 09/10/2026 documentada no CLAUDE.md. Vale considerar fazer essas tarefas (15-19) numa leva só, como já foi feito antes.
- Padrão recorrente nos achados de Nível 5: toda vez que aparece uma tabela com campos de **texto livre onde deveria haver FK** (`instalacao_cronograma.montador`/`.endereco`, `equipamentos_spec.project_id` nunca preenchido, `contratos_venda_equipamentos.project_id` só no editor legado), é sinal de um pedaço do sistema que nasceu antes do modelo atual (`numero_cotacao`/`dossier_obra`/`master_id`) e nunca foi migrado. Antes de "consertar" qualquer um desses pontos, vale perguntar ao usuário se aquele pedaço específico ainda é usado de verdade no dia a dia da empresa — pode ser que alguns desses sejam telas abandonadas que ninguém mais abre (como parece ser o caso de `desenho-tecnico.jsx`), caso em que a solução mais simples é tirar do menu, não reconectar.

---

## Formato do relatório final a entregar ao usuário (do pedido original, `06_IMPLEMENT.md`)

Depois de concluir a Tarefa 0, montar (ou pedir para a próxima sessão montar) o relatório consolidado no formato abaixo — isso é só APRESENTAÇÃO dos achados já feitos (não uma nova investigação):

```
# 📊 RELATÓRIO DE VARREDURA TÉCNICA E ARQUITETURAL

## 1. Resumo da Varredura
- Módulos Analisados: 4
- Total de Telas Inspecionadas: 23
- Pontos de Atenção Identificados: X Ambiguidades | Y Redundâncias | Z Erros/Gaps | W Telas Desconectadas

## 2. Detalhamento por Módulo
### A. Engenharia & Produto (8 telas)   -> ver Anexo A
### B. Obras & Instalação (6 telas)     -> ver Anexo B (completar com a Tarefa 0)
### C. Entrega & Documentação (4 telas) -> ver Anexo C
### D. Parceiros & Instaladores (5 telas) -> ver Anexo D

## 3. Fontes de Verdade e Tabelas Duplicadas/Legadas
[Consolidar as 4 tabelas "Tela | Arquivo | Tabela(s) Supabase | Observação" dos 4 anexos]

## 4. Matriz de Recomendações Priorizadas
[A lista numerada 1-30(+) deste documento, em formato de tabela: Módulo/Tela | Problema | Categoria | Impacto | Recomendação]
```

---

# ANEXO A — Engenharia & Produto (8 telas) — relatório completo do agente (CONCLUÍDO)

Auditoria 100% read-only finalizada (Read/Grep/Bash somente leitura; nenhum arquivo alterado, nenhuma chamada MCP de escrita).

## 1. `engenharia` — "Engenharia" (hub de projetos)
**Arquivo:** `src/operacoes.jsx` (`EngenhariaPage`, L162–342; `ModalNovoProjeto`, L6–38). **Tabela:** `projetos` (texto livre, id gerado no cliente `'PJ-'+Date.now()`).

- **Ambiguidades:** menu lateral diz "Engenharia" (`shell.jsx:84`), `BREADCRUMB_MAP` também "Engenharia"/"Engenharia" (`shell.jsx:391`), mas `<h1>` real (`operacoes.jsx:193`) e `document.title` (`app.jsx:56`) dizem **"Projetos de Engenharia"**.
- **Redundâncias/Duplicações:** `projetos` é a MESMA classe de tabela "era mock" já documentada no CLAUDE.md para a extinta `InstalacaoPage` (migrada para `dossier_obra`/`equipamentos_obra` em 29/10, PR #1138) — aqui essa tabela legada segue ativa, nunca migrada.
- **Erros/Gaps de conectividade (achado central):** aba "Gatilhos Importação" chama `window.ProjectGates.validarGatesImportacao` (`project-gates.js:14-92`), comparando `project_id` em 3 tabelas. Confirmado por inspeção cruzada que os 3 gates são **estruturalmente inalcançáveis**: (a) `equipamentos_spec.project_id` nunca é escrito por `engenharia-config.jsx:save()` (L209-228, objeto `row` não tem o campo); (b) `contratos_venda_equipamentos.project_id` só é escrito pelo editor jurídico LEGADO (`contrato-editor.jsx:231`), nunca pelo fluxo moderno (`contrato-venda-store.js`, que usa `numero_cotacao`/`proposta_id`); (c) consulta a `instalacao_cronograma.endereco` tem comentário do próprio autor admitindo incerteza de schema (`project-gates.js:43`). A UI "✅/⏳" é cosmética, nunca fecha pelo caminho real. Também: botão "Anexar" é stub puro (mostra toast "configurar bucket", nunca sobe arquivo, L255); 3 de 7 abas (BOM/Visita/NCM) são texto estático; KPIs "Visitas semana"/"SLA laudo" fixos em "—".
- **Desconexão do sistema:** `projetos.id` não se conecta a `numero_cotacao`/`dossier_obra`/`formularios_elevador`/`master_id`.

## 2. `eng-projeto-elevadores` — "Projeto de Elevadores"
**Arquivos:** `src/engenharia-elevador.jsx` (abas Desenhos/Especificação) + `src/projeto-elevador-store.js`. **Tabelas:** `projetos_elevador` e `projetos_elevador_desenhos`, SEM FK entre si.

- **Ambiguidades (confirma hipótese do enunciado):** as 2 abas renderizam o mesmo `<h1>` "Projeto de Elevadores" (L231, L684) mas são conceitos de dado diferentes: "Especificação técnica" = projetos por cotação (`projetos_elevador`); "Desenhos" = repositório de arquivos (`projetos_elevador_desenhos`) que **resolve a obra de novo, independentemente**, buscando por `numero_cotacao` (`projeto-elevador-store.js:129-144`) em vez de referenciar a linha da outra aba. Nada avisa se as duas divergem para a mesma cotação.
- **Redundâncias:** nenhuma entre si além do consumo natural de `formularios_elevador`/`propostas`/`precificacoes_elevador`.
- **Erros/Gaps:** nenhum stub — a MELHOR tela das 8. `useRouteTab`+`useRotaItem` dão deep-link/F5 reais (comentário no código cita a correção da "varredura de URLs, 09/10").
- **Desconexão:** nenhuma — amarrada por `numero_cotacao`, emite eventos reais (`PROJETO_ELEVADOR_CRIADO/_FINALIZADO`), renderiza `<AvalEngenhariaCard/>` (3º aval de compra).
- **Nota:** `dossier_obra.codigo_obra` NÃO é referenciado em nenhum lugar deste arquivo (confirmado por grep) — futura ART ainda sem gancho aqui.

## 3. `eng-configurador` — "Projeto de Equipamento"
**Arquivo:** `src/engenharia-config.jsx`. **Tabela:** `equipamentos_spec`.

- **Ambiguidades:** o form avisa "Elevador tem tela própria" (L264) mas não avisa sobre a sobreposição com `desenho-tecnico`.
- **Redundâncias/Duplicações (achado principal):** `eng-configurador` e `desenho-tecnico` (tela 4) são DUAS telas para o MESMO problema — configurar escada/esteira rolante (ângulo, rise, largura, velocidade, motorização, economia de energia) — com modelos de dado e formatos de código incompatíveis, sem link cruzado.
- **Erros/Gaps:** sem `useRouteTab`/`useRotaId` — lista e edição vivem só em `useState`, F5 sempre volta à lista vazia. `id` gerado no cliente. `equipamentos_spec.project_id` nunca é preenchido (mesma lacuna que trava o gate 1).
- **Desconexão:** sem `numero_cotacao`/`dossier_id`/`cliente_id`/`master_id` — "Prédio/Empreendimento" é texto livre.

## 4. `desenho-tecnico` — "Projetos ER/Es"
**Arquivo:** `src/desenho-tecnico.jsx`. **Tabela:** NENHUMA.

- **Ambiguidades:** menu diz "Projetos ER/Es" (`shell.jsx:87`), mas breadcrumb/título/h1 dizem "Desenho Técnico ER | ES".
- **Redundâncias:** sobreposição completa com tela 3; SKU próprio incompatível com o padrão `VPxx-NNNN` do resto do sistema (ex. `VP-ER-30-1000-04500-DD220-STB-GLS-S050`); cita marcas concorrentes (Otis/KONE/Schindler/Thyssen) como "compatibilidade OEM".
- **Erros/Gaps (achado central):** ZERO chamadas ao Supabase em 418 linhas (confirmado por grep de `.from(`/`supabase`/`__VP_SB`/`Store`) — 100% `useState`, nada persiste, F5 apaga tudo. "Solicitar orçamento" só mostra toast de texto. "Exportar ficha (PDF)" é só `window.print()`.
- **Desconexão:** total — é um configurador-vitrine (originalmente artefato de demonstração "Claude Designer"), sem vínculo com nenhuma tabela real do sistema. É o stub mais puro das 8 telas.

## 5. `solicitacoes-produto` — "Solicitações de Produto"
**Arquivos:** `src/solicitacoes-produto.jsx` + `-store.js`. **Tabelas:** `solicitacoes_produto`, `alertas`, bucket `engenharia`.

- **Ambiguidades:** nenhuma.
- **Redundâncias:** nenhuma.
- **Erros/Gaps (menores):** e-mails de notificação (`EMAIL_ENGENHARIA_RESPONSAVEL`/`EMAIL_IMPORTACAO_RESPONSAVEL`) hardcoded no JS (store L52-53) — já exigiu deploy manual ao trocar de pessoa (16/10). Conversão para Ficha Técnica usa `VpRouter.navigate`+`dispatchEvent(popstate)` manual porque a página não recebe `setRoute`/`setSubsel` como prop — funciona, mas é uma 2ª convenção de navegação diferente da documentada no CLAUDE.md.
- **Desconexão: por desenho, não por falha** — sem FK a `numero_cotacao`/`dossier_obra` (comentário explícito no código), coerente com o propósito (cadastrar produto novo, não processar uma venda).

## 6. `ficha-tecnica` — "Ficha Técnica"
**Arquivos:** `src/ficha-tecnica.jsx` + `-engine.js` + `-store.js`. **Tabelas:** `fichas_tecnicas`, `catalogo_produtos` (espelho), `fichas_lib_*`, bucket `fichas-imagens`.

- **Ambiguidades:** nenhuma de rótulo.
- **Redundâncias/Duplicações (relevante, confirma hipótese do enunciado):** `catalogo_produtos` é escrito por 2 caminhos não coordenados — (a) sync automático de toda Ficha salva (`syncCatalogoProduto`, gera id sintético `'ft-'+ficha.id`); (b) inserção manual direta pela tela 7 via `ModalProdutoCatalogo` — SÓ QUE esse 2º caminho está com o botão de abertura removido (ver achado da tela 7), deixando uma 2ª via de escrita divergente latente no código.
- **Erros/Gaps:** nenhum stub relevante — publicação no Omie usa o sistema genérico de alçadas, consistente com o documentado/testado em produção.
- **Desconexão: por desenho** — sem `numero_cotacao`/`dossier_obra`/`cliente_id` (produto de catálogo, reaproveitável entre cotações).

## 7. `ncm-catalogo` — "Catálogo Siscomex"
**Arquivo:** `src/ncm-catalogo.jsx`. **Tabelas:** `catalogo_produtos`, `operadores_estrangeiros`, `ncm_solicitacoes`, leitura de `fichas_tecnicas`.

- **Ambiguidades (achado mais forte de rótulo de toda a auditoria):** 4 nomes divergentes para a mesma rota — sidebar "Catálogo Siscomex" (`shell.jsx:90`); breadcrumb módulo **"Cadastros"**/página **"Produtos"** (`shell.jsx:392`); `document.title` "Catálogo de Produtos" (`app.jsx:57`); `<h1>` real "Catálogo de Produtos" com eyebrow "Cadastros · Produtos" (L507-509). Por isso a URL real é `/cadastros/ncm-catalogo` (confirmado em `docs/MAPA_DE_ROTAS.md:101` + `router.js MODULE_SLUG`), mesmo a tela estando no menu "Engenharia & Produto". Pior: o breadcrumb "Cadastros/Produtos" colide com a rota **`cadastro-produtos`** (sidebar "Produtos", grupo Fabricação, breadcrumb "Fabricação/Produtos") — são 2 telas/tabelas totalmente diferentes (`catalogo_produtos` vs `pcp_produtos`).
- **Redundâncias:** sobreposição com Ficha Técnica (tela 6); aba "Pedidos a fornecedor" é definida em arquivo fora do escopo (`pedido-fornecedor.jsx`) embarcada aqui sem relação óbvia com classificação fiscal.
- **Erros/Gaps (código morto confirmado):** botão "+ Novo produto" do catálogo foi removido da UI (hoje só texto "📋 Produtos vêm da Ficha Técnica", L513), mas `showProd`/`ModalProdutoCatalogo` (~100 linhas) continuam renderizados condicionalmente (L656) e são **inalcançáveis** — confirmado por grep que `setShowProd(true)` nunca é chamado em todo o arquivo. Modal morto pronto para reabrir uma 2ª via de cadastro conflitante. Também: `ModalProdutoCatalogo`/`ModalOperadorEstrangeiro` sugerem CNPJ raiz padrão "54123456" (L112, L213) — não bate com o CNPJ real da VerticalParts documentado no CLAUDE.md (15.822.325/0001-27 → raiz 15822325), parece placeholder de scaffold nunca corrigido.
- **Desconexão do sistema:** coluna do kanban "Solicitações NCM" chamada "Cadastrado Siscomex" ("Produto ATIVO disponível para Duimp") só faz `update status` em `ncm_solicitacoes` (L712-728) — NÃO cria nem vincula nada em `catalogo_produtos`. Mover o card é uma afirmação textual sem efeito real.

## 8. `linha-do-tempo` — "Linha do Tempo da Cotação"
**Arquivos:** `src/linha-do-tempo.jsx` + `-store.js`. **Tabelas (só leitura):** `dossier_obra`, `dossier_history`, `vistorias_atividades`, `instalacao_checklist_itens`, `pi_importacao`, `embarques_importacao`, `emails_projeto`, + `EventosFluxo`/`DecisoesStore`.

- **Ambiguidades/Redundâncias:** nenhuma.
- **Erros/Gaps:** nenhum stub; única simplificação assumida (não bug): e-mails de entrada sempre recebem papel "Fornecedor" por aproximação (comentário explícito no código).
- **Desconexão: o oposto** — é a tela MAIS conectada das 8, agregando `numero_cotacao` através de 6+ fontes do sistema. Referência de bom desenho.

## Tabela — Fontes de Verdade (Anexo A)

| Tela | Arquivo | Tabela(s) Supabase | Observação de 1 linha |
|---|---|---|---|
| Engenharia (hub) | `src/operacoes.jsx` | `projetos` | Tabela legada "mock-era"; gates de importação comparam `project_id` que nenhum fluxo moderno grava — permanentemente falso. |
| Projeto de Elevadores | `src/engenharia-elevador.jsx` + `projeto-elevador-store.js` | `projetos_elevador`, `projetos_elevador_desenhos` | Duas tabelas sem FK sob o mesmo título/rota; é a tela mais bem conectada (eventos, aval, `numero_cotacao`). |
| Projeto de Equipamento | `src/engenharia-config.jsx` | `equipamentos_spec` | Sem deep-link/F5; duplica funcionalmente `desenho-tecnico`; `project_id` nunca é gravado. |
| Projetos ER/Es | `src/desenho-tecnico.jsx` | nenhuma | Zero Supabase — configurador 100% client-side, nada persiste, "Solicitar orçamento" é só um toast. |
| Solicitações de Produto | `src/solicitacoes-produto.jsx` + `-store.js` | `solicitacoes_produto`, `alertas` | Bem construída; e-mails de notificação hardcoded no JS; sem FK a cotação por desenho correto. |
| Ficha Técnica | `src/ficha-tecnica.jsx` + `-engine.js` + `-store.js` | `fichas_tecnicas`, `catalogo_produtos`, `fichas_lib_*` | Sincroniza `catalogo_produtos` automaticamente; é o verdadeiro "dono" do catálogo apesar do nome da tela 7. |
| Catálogo Siscomex | `src/ncm-catalogo.jsx` | `catalogo_produtos`, `operadores_estrangeiros`, `ncm_solicitacoes` | 4 rótulos divergentes para a mesma rota; modal de cadastro manual morto (código inalcançável); coluna kanban "Cadastrado Siscomex" não cadastra nada de fato. |
| Linha do Tempo da Cotação | `src/linha-do-tempo.jsx` + `-store.js` | leitura de 7+ tabelas (sem tabela própria) | Camada agregadora read-only por `numero_cotacao`; nenhum achado negativo — referência de bom desenho. |

**Resumo executivo dos 3 achados mais graves (por impacto), segundo o agente:**
1. `desenho-tecnico.jsx` é um stub completo sem nenhuma persistência — zero chamadas ao Supabase.
2. `project-gates.js` (usado pela tela "Engenharia") tem seus 3 gates estruturalmente inalcançáveis por divergência de schema/fluxo entre o que ele consulta (`project_id`) e o que os fluxos modernos realmente gravam (`numero_cotacao`/`proposta_id`).
3. `ncm-catalogo.jsx` tem um modal de cadastro manual morto (código inalcançável, `setShowProd` nunca chamado) convivendo com o sync automático vindo de Ficha Técnica, mais 4 rótulos divergentes para a mesma rota e uma coluna de kanban ("Cadastrado Siscomex") que não cadastra nada de fato.

---

# ANEXO B — Obras & Instalação (6 telas) — relatório completo do agente (CONCLUÍDO)

Nenhum arquivo foi alterado; só Read/Grep/Bash de leitura foram usados.

## 1) `status-obras` — "Dossiês de Obras" → `ObrasStatusPage`
Arquivo: `src/dossier-obra.jsx:22-130` (lista) + `src/dossier-store.js` (`window.__DOSSIER`, CRUD). Tabelas: `dossier_obra` (via `DossierStore.listar`), `equipamentos_obra` (`dossier-obra.jsx:35`, só `dossier_id, numero_serie`); a página de detalhe (rota irmã `dossier-obra`, fora do escopo mas destino do clique) também lê `contratos_instalador` (`dossier-obra.jsx:558`).

**Ambiguidades**
- O rótulo do menu já foi trocado para "Dossiês de Obras" (`shell.jsx:99`, com comentário explícito "só o rótulo mudou pra deixar isso descobrível — Achado 01 da auditoria"), mas **dentro da própria tela nada acompanhou a troca**: o `<h1>` continua "Status de Obras" (`dossier-obra.jsx:70`), o eyebrow continua `Engenharia · Status de Obras` (`dossier-obra.jsx:69`), e `BREADCRUMB_MAP["status-obras"]` continua `{ module: "Engenharia", page: "Status de Obras" }` (`shell.jsx:378`). Resultado: a única referência a "Dossiês de Obras" no sistema inteiro é o item do menu lateral — abrir a tela, olhar o título, o eyebrow ou o breadcrumb mostra o nome antigo.
- **Breadcrumb aponta pro grupo ERRADO, e é clicável**: `Header` (`shell.jsx:701-716`) monta `moduleHome = MODULE_HOME[bc.module]` e torna o segmento do meio do breadcrumb um botão que navega pra lá. Como `bc.module` é "Engenharia" (não "Obras & Instalação", o grupo real do menu onde esta tela vive hoje — `shell.jsx:98`), clicar em "Engenharia" no breadcrumb desta tela leva para a rota `engenharia` (`MODULE_HOME["Engenharia"] = "engenharia"`, `shell.jsx:458`) — a tela legada "Projetos de Engenharia" (`operacoes.jsx:162`, fora do escopo, sobre laudos/visitas, tabela `projetos`), **sem nenhuma relação com Dossiês de Obras**. Isso é um link de navegação real, clicável, levando a lugar nenhum relacionado — não é só texto desatualizado.
- **3 implementações independentes do "Nº da Obra" para a mesma entidade, com valores DIFERENTES**: aqui (`dossier-obra.jsx:57,107,361`) o número exibido é `window.MasterIdEngine.etapaId('obra', numero_cotacao)` → prefixo **`VPOB-`** (`master-id-engine.js:61`: `obra: 'VPOB'`), calculado ao vivo, sem persistir. Já a coluna `dossier_obra.codigo_obra` (persistida em 29/10/2026, migration `supabase/migrations/20261029150000_dossier_obra_codigo_obra.sql`, pensada explicitamente "pra poder ser citada numa ART futura") usa prefixo **`VPNI-`** (o mesmo do Contrato do Instalador) e é a que a tela "Instalação em Campo" (item 4) de fato mostra. Ou seja: a mesma obra (ex. cotação 955) aparece como `VPOB-0955` em "Dossiês de Obras" e como `VPNI-0955` em "Instalação em Campo" — nenhuma das duas telas lê a coluna da outra.

**Redundâncias/Duplicações**
- Consulta a `dossier_obra`+`equipamentos_obra` reimplementada aqui, de novo em `vistorias-obras.jsx` (seletor de obra), de novo em `mapa-obras.jsx`, de novo em `instalacao-campo-store.js` — 4 queries ad-hoc parecidas, cada uma com seu próprio shape/filtro, sem um hook/store único de "lista de obras".
- `window.MasterIdEngine.etapaId('obra', ...)` é chamado 3x literalmente nesta tela (linhas 57, 107, 361) em vez de calculado 1x e reaproveitado — não é bug funcional, mas é a mesma fórmula escrita 3 vezes no arquivo.

**Erros/Gaps de conectividade**
- Nenhuma filtragem (`statusFiltro`, `busca`) é refletida na URL (`useState` puro, `dossier-obra.jsx:26-27`) — F5 ou compartilhar o link sempre volta pra lista completa sem filtro. Baixa severidade, mas é um gap real de deep-link/F5 (o padrão do projeto, confirmado em outras telas, é usar `useRotaItem`/`useRouteTab` pra isso).

**Desconexão do sistema**
- Nenhuma desconexão de dado grave: `numero_cotacao`, `lead_id`, `status_master` conectam corretamente ao funil (Lead → Formulário → Proposta → Dossiê), confirmado em `dossier-store.js:10-54`.

## 2) `vistorias-envio` — "Vistorias de Obras" → `VistoriasEnvio`
Arquivo: `src/vistorias-envio.jsx` (1078 linhas) + `src/vistorias-questionarios-store.js`. Tabelas: `vistorias_questionarios`, `vistorias_categorias`, `vistorias_perguntas`, `vistorias_atividades`, `vistorias_respostas` (todas via o store); a própria tela só faz `.from()` direto em `dossier_obra`, `equipamentos_obra`, `colaboradores_vpsistema` (linhas 549-552).

**Ambiguidades**
- **Comentário de cabeçalho desatualizado e enganoso**: `vistorias-envio.jsx:14-16` afirma "O link gerado no despacho ainda não abre nada (a página pública de execução no celular é a Fase 3, não construída aqui)". Isso é **falso hoje**: existe `vistoria-execucao.html` + `src/vistoria-execucao.jsx` (já na v9, conferido no `index.html`), com rota real no backend (`server.js:326-331`: `app.get('/vistoria/:token', ...) → res.sendFile('vistoria-execucao.html')`) e lógica de leitura/escrita completa em `vistorias_respostas`/`vistorias_atividades` (`vistoria-execucao.jsx:416-570`). O link gerado aqui (`vistorias-envio.jsx:603,918`: `origin + '/vistoria/' + token`) abre essa página de verdade. Quem ler só o comentário do topo do arquivo concluiria (erradamente) que a funcionalidade não existe.
- Eyebrow da tela diz `Engenharia · Vistorias de Obras` (`vistorias-envio.jsx:72,278`) — mesmo problema do item 1: módulo errado/antigo (deveria ser "Obras & Instalação"). `BREADCRUMB_MAP["vistorias-envio"]` também diz `module: "Instalação & Entrega"` (`shell.jsx:429`) — uma TERCEIRA grafia diferente para o mesmo "onde estou" (eyebrow diz uma coisa, breadcrumb diz outra, sidebar diz uma terceira).

**Redundâncias/Duplicações**
- `veVpobLabel()` (`vistorias-envio.jsx:20-26`) reimplementa à mão a mesma fórmula `'VPOB-' + padStart(numero_cotacao,4,'0')` que `dossier-obra.jsx` já calcula via `MasterIdEngine.etapaId('obra', ...)` — é a MESMA lógica (prefixo VPOB), copiada sem chamar o helper compartilhado. Usada em 3 lugares (linhas 609, 868, 1067).

**Erros/Gaps de conectividade**
- Nenhum stub real encontrado nesta tela além do comentário desatualizado acima — ao contrário, é a tela com a MELHOR cobertura de deep-link do módulo: `useRouteTab('vistorias-envio', 'despacho', [...])` (linha 29) + `useRotaItem` em 3 pontos (linhas 39, 541, 981), cobrindo as 3 abas e os itens selecionados dentro de cada uma.

**Desconexão do sistema**
- Nenhuma encontrada; conecta corretamente com `dossier_obra`/`equipamentos_obra` para montar o despacho e alimenta de fato `vistorias_atividades`/`vistorias_respostas`, que é a mesma fonte lida pelo item 3 (Resultado Vistorias de Obras) e pelo item 5 (Mapa de Obras, só a contagem de concluídas).

## 3) `vistorias` — "Resultado Vistorias de Obras" → `VistoriasObras`
Arquivo: `src/vistorias-obras.jsx` (582 linhas). Tabelas: `dossier_obra`, `equipamentos_obra` (seletor, linhas 64-65), `vistorias_respostas` (linha 397); progresso real vem de `window.InstalacaoObraStore.obterProgressoVistoria` → lê `vistorias_atividades` (não direto nesta tela).

Esta é a tela mais bem documentada e mais "limpa" das 6 — vale destacar como ponto positivo confirmado, não achado de problema.

**Ambiguidades**
- Nenhuma relevante encontrada no texto/rótulo (h1 "🏗️ Resultado Vistorias de Obras", linha 101/134, bate com o rótulo atual do menu, `shell.jsx:101`).

**Redundâncias/Duplicações**
- **Já resolvida, confirmada por código**: o próprio cabeçalho do arquivo (`vistorias-obras.jsx:1-30`) documenta que esta era 1 de 3 implementações paralelas de vistoria que existiam sem se falar, consolidadas em 15/08; e que o agendamento manual antigo (`vistorias_obras`, tabela separada de `vistorias_atividades`) foi removido em 12/10/2026 (linhas 5-7, 80-90). **Confirmei por grep em todo o `src/`: não existe mais nenhuma referência viva a `vistorias_obras`** (tabela) em nenhum arquivo `.jsx`/`.js` — só sobra em 2 comentários explicando a remoção. O "achado hipotético" de que as duas tabelas de vistoria causariam uma obra aparecer "vistoriada" numa tela e "não vistoriada" na outra **já foi corrigido** (item A3 da auditoria #843, 12/10/2026) — não é mais reproduzível no código atual.

**Erros/Gaps de conectividade**
- Sem `useRotaId`/`useRouteTab`: a obra selecionada é escrita na URL via `window.VpRouter.navigate('vistorias', o.id)` direto (linha 48), não pelo hook padrão — funciona (2º segmento da URL), mas é um padrão ligeiramente diferente do resto do módulo (não há bug visível, só inconsistência de estilo de implementação).
- Usa classe CSS própria `page-header`/`page-header` (linha 99,131) em vez do padrão `page-head`/`page-head__eyebrow` usado pelas outras 5 telas do módulo — não tem eyebrow nem breadcrumb hardcoded, então não herda o problema de módulo errado dos itens 1/2/6, mas também não segue o design system comum (cosmético, não funcional).

**Desconexão do sistema**
- Nenhuma. `obra_id` sempre é `dossier_obra.id` (comentário linha 14), consistente com o resto do módulo.

## 4) `instalacao` — "Instalação em Campo" → `InstalacaoPage`
Arquivo: `src/operacoes.jsx:823-903` (dentro de um arquivo de 905 linhas que também hospeda `EngenhariaPage`/`JuridicoPage`, rotas `engenharia`/`juridico`, fora do escopo) + `src/instalacao-campo-store.js` + `src/instalacao-campo-calc.js`. Tabelas: `dossier_obra`, `equipamentos_obra`, `parceiros_instaladores`, `dossier_obra_instaladores` (todas em 1 única rodada paralela, `instalacao-campo-store.js:19-24`).

**Ambiguidades**
- Nenhuma de rótulo/breadcrumb: eyebrow correto "Obras & Instalação · Instalação" (`operacoes.jsx:858`), `BREADCRUMB_MAP["instalacao"]` também diz `Instalação & Entrega` (grafia antiga, mesmo problema dos itens 1/2/6, mas pelo menos o destino do `MODULE_HOME["Instalação & Entrega"]` = `vistorias-envio` continua dentro do grupo certo, diferente do item 1).
- Esta é a ÚNICA das 6 telas que usa corretamente `dossier_obra.codigo_obra` (persistido), com fallback explícito documentado em comentário (`instalacao-campo-calc.js:9-21,43-70`) para quando o campo não existe. **É a referência correta do módulo — os itens 1 e 2 deveriam ter sido migrados pra usar o mesmo valor e não usam.**

**Redundâncias/Duplicações**
- `operacoes.jsx` é arquivo-fonte compartilhado entre 3 rotas de 2 grupos de menu diferentes (`instalacao` em "Obras & Instalação"; `engenharia`/`juridico` em outros grupos) — mesmo padrão de redundância de arquivo-fonte do `entrega.jsx` (item 6), mas aqui sem problema prático: o código morto associado (`ModalAgendarInstalacao`/`EquipeChecklist`, tabelas `equipes`/`projetos` vazias) **já foi removido de verdade** — confirmei por grep: zero referências a `equipes` em todo o `src/`; `projetos` só é usada por `EngenhariaPage` (rota diferente, fora do escopo), não mais por `InstalacaoPage`.

**Erros/Gaps de conectividade**
- Nenhum stub: todos os botões têm `onClick` funcional; clique no equipamento abre `dossier-obra` corretamente via `setSubsel`+`setRoute` (linha 850), nunca `VpRouter.navigate` isolado.
- Busca e accordion (`abertos`) são só `useState` (linhas 826-827), sem reflexo na URL — mesmo gap "menor" dos itens 1/3/5.

**Desconexão do sistema**
- Nenhuma. É a tela mais nova (29/10/2026) e mais bem conectada ao dado real (`codigo_obra`, elenco de instaladores via `dossier_obra_instaladores` + legado `parceiro_instalador_id`).

## 5) `mapa-obras` — "Mapa de Obras" → `window.MapaObrasPage` (2 abas: Mapa / Evolução)
Arquivo: `src/mapa-obras.jsx` (366 linhas) + `src/mapa-obras-calc.js` (regras puras, única fonte de classificação "andamento/concluída/aguardando", também usada por `operacoes.jsx` e `instalacao-campo-calc.js` — boa prática, sem duplicação aqui) + `src/evolucao-equipamentos.jsx`/`-calc.js` (aba Evolução) + `src/rolagens-calc.js` (suspeita de data errada nas rolagens do navio). Tabelas: `dossier_obra` (com `latitude/longitude/geo_precisao/pausada_ate/pausa_motivo`, linha 149), `dossier_obra_instaladores`, `vistorias_atividades` (só contagem de concluídas, linha 157), `parceiros_instaladores`; na aba Evolução: `equipamentos_obra`, `embarques_importacao`, `pi_importacao` (vínculo temporário por nº de série, comentário `evolucao-equipamentos.jsx:245-246`), e `acompanhamento_obra_status`/`_itens`/`_links`/`_lancamentos` via `window.AcompanhamentoObraStore` (confirmado por grep em `acompanhamento-obra-store.js`).

**Ambiguidades**
- Eyebrow correto: "Obras & Instalação · Mapa" (linha 304) — igual ao item 4, o mais bem alinhado. `BREADCRUMB_MAP["mapa-obras"]` ainda diz `Instalação & Entrega` (linha 432, mesma grafia antiga dos itens 2/4/6).
- Filtros da aba Mapa (`filtro`, `estilo`) e da aba Evolução (`busca`, `ver`, `soOc`, `soConf`, accordion por card) são todos `useState` locais (linhas 120-126, 301-304) — sem reflexo na URL, mesmo padrão "de propósito" que o próprio projeto já documenta em várias outras telas do sistema (não é uma falha isolada desta tela).

**Redundâncias/Duplicações**
- Nenhuma redundância de lógica encontrada aqui — `MapaObrasCalc.classificar` é chamado (não reimplementado) por todo o módulo. Ponto positivo confirmado.

**Erros/Gaps de conectividade**
- Nenhum stub. Geocodificação via Nominatim **tem sim** um limitador de taxa real (espera de 1100ms entre chamadas, linhas 47 e 202) — a hipótese do enunciado de "nenhuma trava de rate-limit" **não se confirma**: a trava existe e é respeitada.
- Observação técnica (não um bug funcional, mas relevante): as chamadas a `https://nominatim.openstreetmap.org/...` (linhas 39, 60) são feitas direto do navegador, sem nenhum header `User-Agent`/`Referer` identificando a aplicação — a política de uso pública do Nominatim recomenda isso e pode bloquear por IP sem esse identificador; hoje mitigado só pelo cache em `localStorage` (`MO_GEO_CACHE_KEY`).
- `window.DistanciaObra` (chamado linha 66) é carregado por `distancia-obra.js`, que no `index.html` aparece DEPOIS de `mapa-obras.jsx` na ordem dos `<script>` (linha 416 vs 278) — não cheguei a confirmar se isso causa falha real em tempo de execução (os scripts costumam carregar todos antes do primeiro render React neste projeto), então registro só como ponto a verificar, não como erro confirmado.

**Desconexão do sistema**
- Nenhuma. Pelo contrário: esta é a tela mais "costurada" do módulo — soma posição gravada no Dossiê (que ela mesma grava de volta via `window.__DOSSIER.salvarPosicao`, linha 207), progresso do Diário de Obra (`AcompanhamentoObraStore`), contagem de vistorias concluídas e embarque/P.I. da Importação, tudo em um só balão de mapa.

## 6) `art` — "ART" → `ArtPage`
Arquivo: `src/entrega.jsx:6-33` (dentro de um arquivo de 390 linhas que TAMBÉM hospeda `DataBookPage` — rota `databook`, grupo "Entrega & Documentação" — e `CronogramaPage`/modais — rota `cronograma`, grupo "Parceiros & Instaladores" por `CLAUDE.md`; nenhuma das duas está no grupo "Obras & Instalação", confirmando que `entrega.jsx` é compartilhado por 3 rotas de PELO MENOS 3 grupos de menu diferentes). Tabelas: **nenhuma**. `ArtPage` não faz nenhuma chamada a `window.__VP_SB`/Supabase — é só HTML estático com 2 botões ("Abrir obras") que chamam `setRoute('status-obras')`.

**Ambiguidades**
- A própria tela é 100% orientação em texto ("emita a ART no site do CREA, baixe o PDF e anexe na aba Documentos do Dossiê da Obra") — não há nenhum campo de registro/upload/status de ART vinculado a uma obra. Isso é documentado no próprio comentário do arquivo (linhas 35-40) como decisão consciente ("vira redirect, mesmo padrão já usado por ArtPage — achado 'Importante' da auditoria de código"), então não é um stub acidental, é intencional — mas **confirma literalmente o que o enunciado da tarefa cogitou**: é "só orientação estática, sem CRUD real".
- **A ambiguidade mais relevante**: a migration de `dossier_obra.codigo_obra` (29/10/2026) foi motivada explicitamente "pra poder ser citado numa ART futura (ex. 'ART-VPNI-OB0017')" — mas a tela `art` **não usa `codigo_obra` em lugar nenhum**, nem mostra, nem busca por ele, nem tem campo para colar o número da ART emitida. A "ART futura" que justificou a criação do campo persistido ainda não existe; o único consumidor real de `codigo_obra` hoje é a tela 4 (Instalação em Campo).
- Eyebrow diz "Instalação & Entrega · ART" (linha 12) — mesma grafia antiga do `BREADCRUMB_MAP["art"]` (`shell.jsx:433`), então pelo menos internamente consistente entre si (ao contrário dos itens 1/2), mas ainda divergente do nome real do grupo no menu ("Obras & Instalação").

**Redundâncias/Duplicações**
- `entrega.jsx` hospedando `ArtPage`+`DataBookPage`+`CronogramaPage` para 3 grupos de menu distintos é o exemplo mais extremo de "redundância de arquivo-fonte" do módulo (pedido explicitamente pelo enunciado) — mas é consciente e documentado, não acidental: `DataBookPage` tem um comentário (linhas 35-40) explicando que ela mesma já foi convertida de uma tela com CRUD próprio pra um redirect, no mesmo padrão de `ArtPage`.

**Erros/Gaps de conectividade**
- Nenhum botão quebrado: os 2 cliques (`Abrir obras`/`Ir para a lista de obras`) levam corretamente a `status-obras` via `setRoute`.

**Desconexão do sistema**
- A tela está "desconectada" por desenho: não lê nem grava nenhuma tabela, só orienta e redireciona. Não é um bug, é o estado real e assumido do módulo — mas é o ponto onde a lacuna entre "o que o banco já persiste" (`codigo_obra`, pronto pra virar nome de documento) e "o que a tela entrega" (zero registro) é mais nítida.

## Tabela Resumo (Anexo B)

| Tela | Arquivo | Tabela(s) Supabase | Observação de 1 linha |
|---|---|---|---|
| Dossiês de Obras (`status-obras`) | `src/dossier-obra.jsx` (ObrasStatusPage) + `src/dossier-store.js` | `dossier_obra`, `equipamentos_obra` | Breadcrumb/eyebrow/h1 ainda dizem "Engenharia · Status de Obras" (nome pré-rename) e o link do breadcrumb leva pra rota `engenharia`, errada; número da obra exibido (`VPOB-`) diverge do `codigo_obra` persistido (`VPNI-`) usado no item 4. |
| Vistorias de Obras (`vistorias-envio`) | `src/vistorias-envio.jsx` + `src/vistorias-questionarios-store.js` | `vistorias_questionarios`, `vistorias_categorias`, `vistorias_perguntas`, `vistorias_atividades`, `vistorias_respostas` | Comentário de cabeçalho diz que a página pública de execução "não foi construída" — falso: `vistoria-execucao.html`/`.jsx` (v9) existe e funciona via `/vistoria/:token`; melhor cobertura de deep-link (useRouteTab+useRotaItem) do módulo. |
| Resultado Vistorias de Obras (`vistorias`) | `src/vistorias-obras.jsx` | `dossier_obra`, `equipamentos_obra`, `vistorias_respostas` (progresso via `vistorias_atividades`) | Tela mais limpa do módulo; consolidação de 3 implementações paralelas e remoção da tabela legada `vistorias_obras` já confirmadas pelo código (zero referência viva a `vistorias_obras` no `src/`). |
| Instalação em Campo (`instalacao`) | `src/operacoes.jsx:823-903` (InstalacaoPage) + `instalacao-campo-store.js`/`-calc.js` | `dossier_obra`, `equipamentos_obra`, `parceiros_instaladores`, `dossier_obra_instaladores` | Única tela que usa o `codigo_obra` persistido corretamente; código morto antigo (`equipes`/`projetos`/modais) confirmado removido; arquivo-fonte compartilhado com rotas `engenharia`/`juridico` de outros grupos. |
| Mapa de Obras (`mapa-obras`) | `src/mapa-obras.jsx` + `mapa-obras-calc.js` + `evolucao-equipamentos.jsx`/`-calc.js` | `dossier_obra`, `dossier_obra_instaladores`, `vistorias_atividades`, `parceiros_instaladores`, `equipamentos_obra`, `embarques_importacao`, `pi_importacao`, `acompanhamento_obra_status`(+itens/links/lancamentos) | Melhor-conectada tecnicamente (classificação compartilhada, rate-limit do Nominatim real); eyebrow correto, mas `BREADCRUMB_MAP` ainda com nome de grupo antigo; filtros internos não refletem na URL. |
| ART (`art`) | `src/entrega.jsx:6-33` (ArtPage) | nenhuma | Tela 100% estática/orientação, sem CRUD, sem usar o `codigo_obra` que foi persistido justamente para ser citado numa "ART futura"; arquivo compartilhado com `databook`/`cronograma` de outros 2 grupos de menu. |

---

# ANEXO C — Entrega & Documentação (4 telas) — relatório completo do agente (CONCLUÍDO)

Confirmação prévia (ponto de partida obrigatório, per CLAUDE.md): verificado no código atual (`src/router.js`, `src/shell.jsx` NAV_GROUPS, `src/app.jsx`) que o estado pós-reversão de 28/10/2026 se mantém — `central-documentos`, `databook` e `handover` são 3 rotas/itens de menu totalmente independentes, sem abas, sem wrapper comum, nenhum `RepositorioDocumentosShell` existe mais. `repositorio-documentos` é de fato um 4º item isolado (upload genérico, tabela própria `repositorio_documentos`). Não há indício de que a consolidação tenha voltado.

## 1) CENTRAL DE DOCUMENTOS (`central-documentos`)
Arquivos: `src/central-documentos.jsx` (UI) + `src/central-documentos-store.js` (`window.CentralDocumentos`).
Tabelas lidas: `dossier_obra` (agrupado por `client_name` = "obra"), `dossier_documentos` (ART/Termo de Vistoria/DataBook/Termo de Entrega/Alvará/etc., join por `dossier_id`), `parceiros_instaladores`, `parceiros_colaboradores`, `parceiros_documentos_colaborador` + `parceiros_doc_catalogo`. Única escrita: `dossier_obra.doc_instalador_enviado_em/_por` via `InstalacaoChecklistStore.marcarDocInstaladorEnviado` (instalacao-checklist-store.js:328-339), disparada pelo botão "📤 Marcar documentação do instalador como enviada" (central-documentos.jsx:186-189).
Conexão ao fluxo: usa `dossier_obra.numero_cotacao` só para exibição (não para join); navega de verdade para `dossier-obra` e `rh-homologacao` via `setSubsel`+`setRoute` (padrão correto, não usa `VpRouter.navigate` isolado).

**Ambiguidades**
- O nome "Central de Documentos" sugere um repositório próprio, mas é 100% uma visão agregada só-leitura sobre tabelas de outras telas — não existe `central_documentos` nem nenhuma tabela própria. É mais um "painel de checklist" que uma "central" de arquivos.
- A tela não segue o padrão visual/estrutural das outras 3 do mesmo grupo: não tem `<div className="page-head">`/`<h1 className="page-head__title">` — o título "📁 Central de Documentos" (central-documentos.jsx:106) é uma `div` dentro da coluna lateral esquerda, não um cabeçalho de página como em `databook`/`handover`/`repositorio-documentos`.

**Redundâncias/Duplicações**
- `TIPOS_DOC_OBRA` é duplicado literalmente entre `central-documentos-store.js:26-37` e `dossier-obra.jsx:795` — o próprio comentário do arquivo (linha 22-25) admite: "duplicado de propósito... Se um dia esse catálogo virar tabela, os dois lugares leem da mesma fonte" — risco real de desalinhamento (ex.: alguém adiciona um tipo de documento num lugar e esquece o outro).
- É o 1º de 3 "repositórios de arquivo" conceitualmente concorrentes no sistema, sem nenhuma relação entre si: (a) `dossier_documentos` (lido aqui), (b) `repositorio_documentos` (tela #4 deste módulo, upload genérico), (c) `projetos_elevador_desenhos` (aba "Desenhos" de Projeto de Elevadores, `src/engenharia-elevador.jsx:275` — "repositório p/ enviar ao cliente", fora do escopo original mas mesma classe de problema). Três tabelas, três UIs, três convenções de soft-delete/bucket, nenhuma delas sabe da existência da outra.

**Erros/Gaps de conectividade**
- **`central-documentos` NÃO existe em `CATALOGO_MODULOS` nem em nenhum `MODULOS_POR_GRUPO_SIDEBAR`** (`src/colaboradores-admin-store.js` — confirmado por grep, zero ocorrências do id `central-documentos` no arquivo inteiro). Os outros 3 irmãos do mesmo grupo de menu (`databook`, `handover`, `repositorio-documentos`) TÊM entrada própria (`colaboradores-admin-store.js:220,246-247,330`). Consequência prática: não há como conceder/restringir essa tela em Administração › Alçadas, e o componente nunca chama `temCapacidade(...)` — nem para ver a tela, nem para o botão de escrita (`marcarDocEnviado`). Enquanto `repositorio-documentos.jsx:96-99` explicitamente checa `temCapacidade('repositorio-documentos','criar'/'excluir')`, `central-documentos.jsx` não tem nenhuma checagem de alçada.
- Duas lacunas confessadas no próprio código (comentários, não achado do agente): linha 213-214 — "Vistorias (Dados Coletados na Obra) são por equipamento — vão morar numa aba 'Equipamentos' dentro desta mesma tela, ainda não implementada"; linha 215 — "Envio para cliente/construtora com rastreabilidade (checklist 'Enviado' + log) é a próxima fase deste módulo — ainda não implementado."

**Desconexão do sistema**
- `BREADCRUMB_MAP['central-documentos'].module = "Engenharia"` (shell.jsx:380), renderizado de verdade no topo da página (Header, shell.jsx:702-703, via `MODULE_HOME[bc.module]`) — mas o item mora no grupo de menu "Entrega & Documentação" (NAV_GROUPS, shell.jsx:114-119) ao lado de `databook`/`handover`, cujo `BREADCRUMB_MAP.module = "Instalação & Entrega"` (shell.jsx:435-436). Ou seja, dois itens do MESMO submenu lateral mostram "módulo" diferente no breadcrumb do topo. Pior: **"Instalação & Entrega" não é mais o `label` de nenhum grupo atual em NAV_GROUPS** (hoje são "Obras & Instalação" e "Entrega & Documentação") — é string legada nunca atualizada nas reorganizações de menu documentadas no CLAUDE.md (17–28/10/2026).

## 2) DATA BOOK & TERMO (`databook`)
Arquivo: `src/entrega.jsx` — função `DataBookPage` (linhas 41-68). **Este arquivo hospeda 4 telas/rotas diferentes do menu**: `ArtPage` (rota `art`, grupo "Obras & Instalação"), `DataBookPage` (rota `databook`), `CronogramaPage` + seus 2 modais (rota `cronograma`, grupo "Parceiros & Instaladores") — é uma redundância estrutural legítima (1 arquivo .jsx ≠ 1 rota), útil registrar porque facilita confundir "editei entrega.jsx" com "mexi só numa tela".
Tabelas: **NENHUMA**. `DataBookPage` não faz nenhuma chamada ao Supabase — é puramente estático (texto + 1 botão).

**Ambiguidades**
- O rótulo de menu "Data Book & Termo" e o H1 interno "Data Book & Termo de Conclusão" sugerem fortemente uma tela de GESTÃO (lista, criação, status), mas na prática é uma página de orientação ("vá anexar no Dossiê da Obra, aba Documentos") com um único botão "Abrir obras" → `setRoute('status-obras')`. Para o usuário, é indistinguível de uma tela funcional até perceber que nunca carrega nada.

**Redundâncias/Duplicações**
- O comentário do próprio arquivo (entrega.jsx:35-40) confirma que isso é deliberado e já fruto de uma auditoria interna anterior: "Antes lia/gravava a tabela legada `projetos` (issue #274, desconectada da esteira real)... Vira redirect, mesmo padrão já usado por `ArtPage` acima — achado 'Importante' da auditoria de código." Ou seja, **esta mesma classe de achado (tela-stub redirecionando pro Dossiê) já foi identificada e corrigida uma vez antes** — o padrão `ArtPage`/`DataBookPage` é intencional, não um bug esquecido.
- O conceito "Data Book" aparece em 3 lugares desconectados: (a) este stub de menu, que não persiste nada; (b) `dossier_documentos` via Dossiê da Obra (onde o arquivo real é anexado, tipo "DataBook (Ebook técnico)"); (c) um item de checklist booleano dentro da tela **Entrega Final/Handover** (`HandoverManutencao.CHECKLIST_ENTREGA`, id `databook_assinado` = "Data Book assinado pelo cliente", handover-manutencao.js:14) — este terceiro não tem nenhum vínculo com o arquivo real de (b); é só uma caixinha marcável à parte.

**Erros/Gaps de conectividade**
- O botão "Abrir obras"/"Ir para a lista de obras" joga só para `status-obras` (lista de obras), não para a obra/aba específica — o usuário tem que procurar a obra de novo manualmente e abrir a aba "Documentos" por conta própria; não é um deep-link funcional para o destino prometido.

**Desconexão do sistema**
- Nenhuma (é estático, não tem estado pra desconectar). O H1 interno e o rótulo de menu combinam razoavelmente bem entre si — a desconexão real é conceitual (nome promete gestão, entrega é um aviso), já coberta acima.

## 3) ENTREGA FINAL (`handover`)
Arquivos: `src/handover-manutencao.jsx` (UI) + `src/handover-manutencao.js` (`window.HandoverManutencao`).
Tabela: só `dossier_obra` — lê a tabela inteira (`select('*')`, handover-manutencao.jsx:18) e lê/grava a coluna jsonb `dossier_obra.handover` (sem tabela própria). Usa `dossier_obra.numero_cotacao`/`building_name` para disparar `EventosFluxo.registrar()` (`HANDOVER_CONCLUIDO`, `POS_VENDA_ATIVADO` — handover-manutencao.js:52-55,90-93) — essa é a única das 4 telas do grupo com conexão real ao motor de gatilhos/Linha do Tempo da Cotação.

**Ambiguidades**
- **4 nomes diferentes para a mesma tela**: rótulo de menu "Entrega Final" (shell.jsx:117) × H1 interno "Handover & Manutenção" (handover-manutencao.jsx:67) × eyebrow interno "Instalação & Entrega · Pós-venda" (linha 66) × `BREADCRUMB_MAP.page` = "Handover & Pós-venda" (shell.jsx:436). É a pior inconsistência de rótulo das 4 telas auditadas — um usuário pedindo ajuda sobre "Entrega Final" pode não reconhecer que a tela que abre se chama "Handover & Manutenção" por dentro.
- Compartilha com `databook` o mesmo nó conceitual ("fechamento da obra, Data Book, garantia, termo de entrega") sem nenhuma distinção clara de responsabilidade entre os dois itens de menu — ver bullet acima sobre `databook_assinado`.

**Redundâncias/Duplicações**
- O item de checklist `databook_assinado` (dentro do handover) duplica, sem vínculo, o conceito que o item de menu `databook` deveria "possuir" — ver seção 2.
- `ModalEditarChecklist` grava em `dossier_obra.handover` (um `update` isolado, handover-manutencao.jsx:321-332) — tecnicamente sem colisão com o Dossiê da Obra porque é uma coluna própria, mas é mais um ponto de escrita na mesma tabela central `dossier_obra`, sem transação/lock, que já tem múltiplos "donos" de diferentes colunas espalhados pelo sistema (confirmado pela ausência de qualquer referência cruzada — ver abaixo).

**Erros/Gaps de conectividade**
- `registrarHandover`/`transferirParaEscamax` só emitem `EventosFluxo` com `numeroCotacao` quando `dossier.numero_cotacao` existe; para dossiês legados sem Nº de cotação (documentado no CLAUDE.md: ~66 dossiês sem `numero_cotacao`), o evento é gravado com `numeroCotacao: null` e nunca aparece na Linha do Tempo da Cotação — silenciosamente incompleto, sem aviso na tela.
- Seleção de projeto (`selected`) é só `useState` local (handover-manutencao.jsx:9) — sem `useRotaId`/`useRouteTab`. F5 ou link direto sempre volta à lista vazia de seleção, nunca reabre o registro específico. Diferente das exceções "de baixo valor" já documentadas no CLAUDE.md (seção de auditoria de URLs de 09/10) — aqui o registro selecionado é um dossiê de obra concreto com dado real (garantia, Escamax), não um estado efêmero de prévia.

**Desconexão do sistema**
- **Mão única real**: `dossier-obra.jsx` (o Dossiê da Obra, tela central do fluxo de pós-venda) não tem NENHUMA referência a "handover"/"Handover" (confirmado por grep, zero ocorrências) — ou seja, de dentro do Dossiê não há link/botão pra abrir "Entrega Final" daquela obra, mesmo a tela de Handover lendo/escrevendo a mesma linha de `dossier_obra`. Quem está no Dossiê não descobre que existe um Handover registrado (ou pendente) para aquela obra sem navegar manualmente até o menu "Entrega Final" e procurar de novo.

## 4) REPOSITÓRIO DOCUMENTOS (`repositorio-documentos`)
Arquivos: `src/repositorio-documentos.jsx` + `src/repositorio-documentos-store.js`. Migration: `supabase/migrations/20261028180000_repositorio_documentos.sql`.
Tabela: `repositorio_documentos` (própria, 10 colunas, RLS fechada — `authenticated` + `vp_tem_capacidade('repositorio-documentos', ...)`, nasce FECHADA por desenho, policies select/insert/update separadas por alçada ver/criar/excluir, sem policy de DELETE de verdade — soft-delete via `excluido_em`/`excluido_por`). Storage: bucket `engenharia` (compartilhado, não exclusivo), path `repositorio-documentos/{timestamp}_{uuid8}_{nome}`.
Esta é a tela tecnicamente mais correta das 4: checa `temCapacidade('repositorio-documentos','criar'/'excluir')` antes de mostrar os botões (repositorio-documentos.jsx:96-99), usa `page-head` padrão, rótulo de menu/eyebrow/H1 todos consistentes ("Repositório Documentos"), RLS corretamente fechada desde o nascimento (comentário da migration cita explicitamente o plano #571).

**Ambiguidades**
- Por desenho é "qualquer documento, sem vínculo com cliente/obra/cotação" — mas na prática compete pelo mesmo papel mental do usuário ("onde eu guardo um arquivo importante?") com `central-documentos` (documentos por obra) e com a aba "Desenhos" de Projeto de Elevadores (`projetos_elevador_desenhos`, também pensada como "repositório pra enviar ao cliente", por cotação). Nada na UI das 3 telas orienta o usuário sobre qual delas usar para um documento que poderia se encaixar em mais de uma categoria (ex.: um manual técnico de equipamento — vai no Repositório genérico, na Ficha Técnica, ou no Projeto de Elevadores?).

**Redundâncias/Duplicações**
- Mesmo padrão de soft-delete/upload de `contratos-sociais.jsx`/`projeto-elevador-store.js` (reconhecido no próprio comentário de cabeçalho do arquivo) — não é duplicação de lógica de negócio, é reaproveitamento de padrão, correto e documentado; cito apenas porque confirma que o sistema tem ≥3 implementações quase-idênticas do mesmo padrão "upload + lista + soft-delete" em vez de um componente genérico compartilhado.

**Erros/Gaps de conectividade**
- Nenhum erro técnico encontrado — `temCapacidade`, RLS, storage e soft-delete estão coerentes entre si. `enviado_por_nome`/`enviado_por_email` vêm de `window.__VP_USER` (não verificável — issue #571), mas essa é uma limitação de segurança já conhecida e documentada em todo o sistema, não específica desta tela.

**Desconexão do sistema**
- É intencionalmente desconectada de `numero_cotacao`/`dossier_id`/`cliente_id` — por desenho (confirmado no comentário da migration e do store), não é um gap.
- Sem suporte a deep-link de item (modal de envio/exclusão usa `useState` puro, sem `useRotaId`) — mas aqui é de fato um caso de baixo valor (modal efêmero de ação, não um registro a reabrir), coerente com os "deixados de fora de propósito" já documentados na varredura de URLs do CLAUDE.md.

## Tabela Resumo (Anexo C)

| Tela | Arquivo | Tabela(s) Supabase | Observação de 1 linha |
|---|---|---|---|
| Central de Documentos | `src/central-documentos.jsx` + `-store.js` | `dossier_obra`, `dossier_documentos`, `parceiros_instaladores`, `parceiros_colaboradores`, `parceiros_documentos_colaborador` | Painel agregado só-leitura (+1 escrita); sem alçada cadastrada em `colaboradores-admin-store.js` e sem `temCapacidade` nenhum. |
| Data Book & Termo | `src/entrega.jsx` (`DataBookPage`, compartilha arquivo com `ArtPage`/`CronogramaPage`) | nenhuma | Stub estático desde auditoria anterior; redireciona pra "Dossiê da Obra", nunca lê/grava nada. |
| Entrega Final | `src/handover-manutencao.jsx` + `.js` | `dossier_obra` (coluna `handover` jsonb) | Única tela do grupo com dado real persistido e eventos de fluxo; 4 nomes diferentes (menu/H1/eyebrow/breadcrumb) e sem link de volta no Dossiê. |
| Repositório Documentos | `src/repositorio-documentos.jsx` + `-store.js` | `repositorio_documentos` | Upload genérico, única das 4 com RLS fechada e checagem de alçada na UI; tecnicamente a mais sólida. |

---

# ANEXO D — Parceiros & Instaladores (5 telas) — relatório completo do agente (CONCLUÍDO)

## ACHADO TRANSVERSAL (vale para as 5 telas)
O grupo de menu "Parceiros & Instaladores" é só um agrupamento visual recente (comentário em `shell.jsx:120-124`: "Substitui o antigo grupo 'RH Operacional' (1 item só)"). A URL de cada rota é montada por `buildPath()`/`moduleSlugFor()` (`router.js:44-71`), que lê o **módulo do `BREADCRUMB_MAP`**, não o grupo do menu. Resultado: as 5 telas do mesmo grupo de sidebar têm prefixos de URL e "módulo" de breadcrumb **todos diferentes entre si e nenhum deles diz "parceiros"**:
- `cadastro-instaladores` → módulo "Cadastros" → `/cadastros/cadastro-instaladores`
- `rh-homologacao` → módulo "RH Operacional" → `/rh/rh-homologacao`
- `contrato-instalador` → módulo "Jurídico" → `/juridico/contrato-instalador`
- `pagamentos-instalador` → módulo "Financeiro" → `/adm-financeiro/pagamentos-instalador`
- `cronograma` → módulo "Instalação & Entrega" → `/engenharia/cronograma`

Isso é o mesmo padrão "menu reagrupa, URL não muda" que o CLAUDE.md já documenta para o Cronograma isoladamente (29/10/2026) — mas na prática ele vale para o grupo INTEIRO, não só para o item que entrou por último. Não é bug (decisão registrada), mas é uma ambiguidade real: breadcrumb e URL de qualquer uma das 5 telas aponta para um "lar" de módulo diferente do que a sidebar sugere.

**Achado específico, NÃO documentado no CLAUDE.md**: o `BREADCRUMB_MAP.cronograma.page` (`shell.jsx` ~linha 434) ainda diz `"Cronograma de Instalação"` (nome antigo, pré-29/10), enquanto o rótulo do menu (`shell.jsx:136`) e o `<h1>` dentro de `entrega.jsx:119` já dizem `"Cronograma de Pagamento da Instalação"`. A renomeação do PR #1135 atualizou sidebar + H1 mas esqueceu a 2ª parte da trilha de breadcrumb no topo da página.

## 1) `cadastro-instaladores` → `src/cadastro-instaladores.jsx` (v19) + store `window.RHHomologacao` (`src/rh-homologacao-store.js`)
Tabelas: `parceiros_instaladores` (empresa), `parceiros_colaboradores` (pessoa física), mais leitura de `dossier_obra`/`dossier_obra_instaladores`/`equipamentos_obra` (hierarquia "Empresa→Cliente→Obras") e `omie_pagamentos_cache` (via `OmiePagamentosStore`, `src/omie-pagamentos-store.js`).

**Ambiguidades**
- O modal de edição da empresa (`ModalNovoMontador`) usado aqui (linha 263) **não está definido neste arquivo** — está fisicamente em `rh-homologacao.jsx:206`, carregado antes no `index.html` (linha 403 vs 404). O comentário em `rh-homologacao.jsx:199-200` confirma a intenção ("Reaproveitado por Cadastros → Empresas Instaladoras"), mas é uma dependência "de trás pra frente": a tela de Cadastro depende de um componente hospedado no arquivo-fonte da tela de RH, o inverso do que a ordem do menu sugere.

**Erros/Gaps de conectividade**
- Deep-link está só parcialmente implementado: `selectEmpresa()` chama `window.VpRouter.navigate('cadastro-instaladores', emp.id)` e há um `useEffect([empresas])` manual que lê `VpRouter.parseLocation()` uma única vez para abrir a empresa certa ao carregar (comentário próprio em linhas 78-93 explica que isso corrigiu um bug real de "Ver documento"). **Mas a tela nunca assina `VpRouter.subscribe`/evento `vp:navigate`** — diferente do padrão `useRotaId`/`useRotaItem` (`src/rota-pcp.js`) usado em `contrato-instalador.jsx`. Resultado: o link direto na 1ª carga funciona, mas **Voltar/Avançar do navegador entre duas empresas diferentes clicadas na mesma sessão não reabre a empresa certa** (a URL muda, o React não re-renderiza).
- `salvarMontador()` (`rh-homologacao-store.js:48-63`) sempre grava `certificacoes: f.certificacoes || {}` a cada edição de empresa — mas o formulário (`ModalNovoMontador`) nunca inicializa nem edita `f.certificacoes` em lugar nenhum. Ou seja, **toda edição de cadastro da empresa zera silenciosamente a coluna `parceiros_instaladores.certificacoes`** (um jsonb de 5 certificações fixas: nr10/nr35/aso/pcmso/pgr). O próprio código já documenta esse campo como obsoleto (comentário em `rh-homologacao-store.js:330-335`: "ninguém mais grava nele desde a migração" para o novo sistema de documentos por catálogo) — mas na prática ALGUÉM ainda grava nele, só que sempre com `{}`. Confirmado por grep: as funções `validarCertificacoes`, `statusGeral`, `statusVariant`, `CERTIFICACOES` (que leem esse campo) não são chamadas por NENHUM outro arquivo do projeto — código morto dos dois lados (escreve lixo, ninguém lê).

**Desconexão do sistema**
- O card da lista de empresas mostra 3 métricas (Funcionários, Elevadores, Pagamentos) mas **nenhum indicador de homologação/compliance** (vencido/válido) — isso só aparece na outra tela (`rh-homologacao.jsx`). As duas telas se descrevem mutuamente nos comentários de topo ("cadastro raso aqui, compliance lá") mas não há nenhum badge cruzado (ex.: "⚠ 2 docs vencidos" no card da empresa aqui) nem link direto de uma tela pra outra além de texto estático na UI.
- "Pagamentos" nesta tela vem de `omie_pagamentos_cache` (reconciliação com Contas a Pagar do Omie, casada por `dossier_id`) — uma fonte TOTALMENTE separada de `contrato_instalador_parcelas` (a fonte usada em "Pagamentos a Instaladores", tela 4). Não há nenhuma comparação/reconciliação visível entre as duas; se divergirem (Omie diz pago, o contrato diz pendente, ou vice-versa) nada na UI avisa isso.

## 2) `rh-homologacao` → `src/rh-homologacao.jsx` (v8) + mesma store `window.RHHomologacao`
Tabelas: `parceiros_instaladores`, `parceiros_colaboradores`, `parceiros_doc_catalogo` (79 tipos), `parceiros_documentos_colaborador`, bucket `parceiros-instaladores-anexos`.

**Erros/Gaps de conectividade**
- **Zero integração com o roteador**: não há nenhuma referência a `window.VpRouter` no arquivo inteiro. Empresa selecionada, colaborador selecionado e modal de documento aberto vivem só em `useState`. F5 ou um link direto sempre cai na lista vazia (nenhum deep-link, nem o parcial que `cadastro-instaladores.jsx` tem). Dentro do próprio grupo "Parceiros & Instaladores" isso contrasta com `contrato-instalador.jsx`, que usa `useRotaItem`/`useRouteTab` de forma completa.

**Ambiguidades**
- "Homologação" **NÃO bloqueia** o uso do parceiro em lugar nenhum desta própria tela nem no Contrato Instalador — é só um repositório de documentos com status calculado. O bloqueio de verdade acontece 2 camadas adiante, fora do escopo das 5 telas (ver "Desconexão" abaixo).

**Desconexão do sistema**
- O comentário no `shell.jsx:120-124` descreve o grupo como "o ciclo inteiro do parceiro instalador (cadastro → homologação → contrato → pagamento) num só lugar". Pela leitura do código, isso é só parcialmente verdade: o campo `parceiros_instaladores.certificacoes` é o único vestígio do "status geral" antigo (hoje morto); o status REAL usado para travar fluxo (`statusGeralPorColaboradores`, em `rh-homologacao-store.js:339-365`) só é consumido fora das 5 telas, em `src/instalacao-obra-store.js:271` (gate "Parceiro instalador homologado" dentro do checklist "obra pronta pra instalação", item 6 de 7) — uma tela de **outro** grupo de menu ("Obras & Instalação" / Dossiê da Obra). Em `contrato-instalador.jsx:155-184` (`CIHomologacaoAviso`) o mesmo status só gera um **aviso visual**, não trava a criação do contrato (comentário explícito nas linhas 150-154: "Aqui é aviso, não bloqueio"). Ou seja, o "fechamento do ciclo" de homologação não acontece dentro do grupo "Parceiros & Instaladores" — acontece em uma 6ª tela, de outro módulo.
- Há ainda uma CAMADA EXTRA de aprovação (item 7 do mesmo checklist, `instalacao-obra-store.js:278-289`): `DecisoesStore.statusMontadorObra(dossierId, parceiroId)` — uma decisão RH **por obra específica**, independente do status geral de documentos. Ou seja, existem 3 noções distintas de "parceiro está liberado": (a) `certificacoes` (morto), (b) status de documentos por colaborador (RH Homologação, tela 2), (c) decisão RH por obra (Central de Decisões, fora do escopo). Nenhuma delas é visível nas 5 telas auditadas ao mesmo tempo.

## 3) `contrato-instalador` → `src/contrato-instalador.jsx` (v46) + `-store.js` (v24) + `-engine.js` (v18)
Tabelas: `contratos_instalador`, `contrato_instalador_parcelas` (via `contrato-instalador-parcelas-store.js`), `instalador_acordos`, `cotacao_custos_reais`, `propostas`, `dossier_obra`, `equipamentos_obra`, `emails_projeto`, `alertas`, `contrato_instalador_distratos`/`documento_signatarios` (distrato bilateral). Liga-se ao fluxo por `master_id`/`proposta_id`/`dossier_ids` (gravados em `contratos_instalador`) e por `numero_cotacao` derivado de `propostas.numero_cotacao` (linhas 305-308) ou parseado do próprio `master_id`.

Esta é, de longe, a tela mais madura/auditada do grupo (confirmado pelo histórico extenso do CLAUDE.md). Nenhum stub (`TODO`/"em breve"/botão sem `onClick`) nem tabela legada paralela equivalente a `contrato-editor.jsx` (esse é exclusivo do Contrato de Venda).

**Conectividade (positivo, para contraste com as outras telas)**
- Deep-link correto e completo: `window.useRotaItem('contrato-instalador', 'painel')` (linha 2283, drawer de auditoria) e `window.useRouteTab('contrato-instalador', 'painel', ['painel','novo'])` (linha 2423) — mesmo padrão robusto usado no PCP/Contrato de Venda, com suporte real a Voltar/Avançar via `VpRouter.subscribe`.

**Ambiguidades**
- O vínculo contrato→empresa instaladora é **indireto**: `contratos_instalador` não tem coluna `parceiro_instalador_id` própria; o vínculo vem de `instalador_acordos.contrato_id→parceiro_instalador_id` (`contrato-instalador-store.js:21-22`). Funcional, mas significa que "quem é o instalador deste contrato" depende de uma tabela de preço-combinado existir e estar preenchida — se um contrato for criado sem acordo de preço vinculado, o comentário da própria função ("Acha o parceiro pelo acordo de preço do contrato... e, sem acordo, pelo nome da contratada") confirma que cai para um fallback por **nome em texto livre** (`contratada_nome`), não por FK.

**Redundâncias/Duplicações**
- Nenhuma nova encontrada além das já documentadas no CLAUDE.md (parcelas, numeração, baixa de PDF). A lógica de cálculo de parcelas vive só em `contrato-instalador-parcelas-store.js`, sem duplicação dentro de `pagamentos-instalador.jsx` (essa tela só lê/filtra, não recalcula).

## 4) `pagamentos-instalador` → `src/pagamentos-instalador.jsx` (v7) + `contrato-instalador-parcelas-store.js` + abas auxiliares `pagamentos-instalador-acordos.jsx`/`-recibos.jsx`
Tabelas: `contrato_instalador_parcelas` (join com `contratos_instalador`), `decisoes_gerenciais` (gate "pagamento_instalador_parcela").

**Conectividade (positivo)**
- Confirmado: `reload()` (linha 26-28) filtra `lista.filter(p => p.contratos_instalador.status === 'assinado')` — exatamente o filtro que o CLAUDE.md descreve ("só contratos assinados geram parcela a pagar"). `aba` usa `window.useRouteTab('pagamentos-instalador', 'parcelas', ['parcelas','acordos','recibos'])` corretamente.

**Erros/Gaps de conectividade (menor)**
- Não há `useRotaId`/`useRotaItem` para nenhuma linha individual da tabela de parcelas (não é crítico — a tela é uma lista flat sem modal de detalhe próprio), mas também não há link direto "abrir o Contrato Instalador correspondente" a partir de uma linha de parcela — o usuário vê `contrato.numero_documento` como texto puro, sem navegação para `contrato-instalador`.

**Redundâncias/Duplicações**
- Mesmo ponto já citado na Tela 1: esta é a 2ª fonte independente de "quanto já foi pago ao instalador" (via `contrato_instalador_parcelas.status='paga'`), paralela à 1ª fonte (`omie_pagamentos_cache`, mostrada em "Empresas Instaladoras"). Nenhuma reconciliação cruzada visível nas 5 telas.

## 5) `cronograma` → `src/entrega.jsx` (v8), função `CronogramaPage` (linhas 83-218)
Tabela: `instalacao_cronograma` (coluna `endereco` e `montador` são TEXTO LIVRE, sem FK para `dossier_obra` nem para `parceiros_instaladores`).

Confirma: `entrega.jsx` hospeda 3 telas (`ArtPage`, `CronogramaPage`, `DataBookPage`) — só `CronogramaPage` está nesta investigação. As outras duas já são, pelo próprio comentário do código, **redirects intencionais** para o Dossiê da Obra, resultado de uma auditoria anterior.

**Desconexão do sistema (achado principal desta tela, e o mais forte da auditoria inteira)**
- `CronogramaPage` é uma mini-CRUD **completamente isolada** do resto do grupo e do pipeline documentado no CLAUDE.md:
  - Campo "Montador" (`ModalNovoCronograma`, linha 346-348) é um `<input>` de texto livre — **não** é um select/autocomplete contra `parceiros_instaladores` (a tabela usada pelas telas 1/2/3/4). Não há `empresa_id`/`parceiro_instalador_id` em lugar nenhum do insert (linhas 305-312).
  - Campo "Endereço" (linha 340-343) também é texto livre — **não** há `dossier_id`, `numero_cotacao`, `master_id` ou `proposta_id` em `instalacao_cronograma`. Não há nenhuma ligação com `dossier_obra`/`equipamentos_obra` (as tabelas usadas por `cadastro-instaladores.jsx` para a árvore "Empresa→Cliente→Obras").
  - O modelo de pagamento "4 fases por marco físico" (Início/Tracionado/Portas+elétrica/Conclusão) é uma **3ª fonte independente** de "pagamento ao instalador", paralela a `contrato_instalador_parcelas` (tela 4, liberação automática pelo Diário de Obra + aprovação do Gestor Comercial) e a `omie_pagamentos_cache` (tela 1, Omie). As 3 nunca se cruzam.
  - **Zero deep-link**: `sel` (linha 87) é puro `useState`, sem nenhuma referência a `VpRouter` no arquivo inteiro — F5 na tela de detalhe das 4 fases sempre volta para a lista.
  - **Botão "Abrir" sem ação** (linha 167): `<Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button>` — **não tem `onClick`**. É um stub real; a única forma de abrir o detalhe é clicando na linha inteira (`onClick={() => setSel(r)}` no `<tr>`, linha 152), tornando o botão "Abrir" 100% decorativo.
  - O único consumidor externo de `instalacao_cronograma` em todo o projeto é `src/project-gates.js` (`validarGatesImportacao`, linha 40-52), que casa `instalacao_cronograma.endereco` contra um `projectId` vindo de `contratos_venda_equipamentos.project_id`/`equipamentos_spec.project_id` — com o próprio código confessando a incerteza no comentário da linha 43: `.eq('endereco', projectId) // ou poderia ser project_id, depende da tabela`. Essas colunas/tabela (`project_id`, `equipamentos_spec`, `projetos`) pertencem a um modelo de dados **pré-`dossier_obra`/`master_id`**, já confirmado morto em outro lugar do próprio repo: `src/operacoes.jsx:740-752` documenta que `equipes`/`projetos` são "tabelas sem NENHUM registro real" (mesmo achado documentado no CLAUDE.md para "Instalação em Campo", 29/10/2026, que trocou essas fontes por `dossier_obra`). `ProjectGates.validarGatesImportacao` só é chamado por `EngenhariaPage` (`operacoes.jsx:178-183`, rota `engenharia`, que ainda está na sidebar com o rótulo genérico "Engenharia" e lê da mesma tabela `projetos` morta). **Conclusão**: o único elo externo de Cronograma no código hoje liga a um branch de sistema igualmente abandonado — na prática, `CronogramaPage` está isolada tanto do pipeline vivo (Formulário→Proposta→Contrato de Venda→Contrato Instalador→Dossiê→Pagamentos) quanto do gate que supostamente a consumiria.

**Redundâncias/Duplicações**
- Mesmo ponto acima, com ênfase: "pagamento por fase/marco ao instalador" já existe de forma robusta e conectada em `contrato_instalador_parcelas` (liberação automática + aprovação formal), tornando o modelo de 4 fases do Cronograma um sistema paralelo, mais simples e sem ligação de dados, para o mesmo propósito de negócio.

## Tabela Resumo (Anexo D)

| Tela | Arquivo | Tabela(s) Supabase | Observação de 1 linha |
|---|---|---|---|
| Empresas Instaladoras | `src/cadastro-instaladores.jsx` (+ modal em `rh-homologacao.jsx`) | `parceiros_instaladores`, `parceiros_colaboradores`, `dossier_obra`, `dossier_obra_instaladores`, `equipamentos_obra`, `omie_pagamentos_cache` | Deep-link só parcial (sem Voltar/Avançar); grava `certificacoes={}` em toda edição, campo morto e lido por ninguém. |
| Homologação de Instaladores | `src/rh-homologacao.jsx` | `parceiros_instaladores`, `parceiros_colaboradores`, `parceiros_doc_catalogo`, `parceiros_documentos_colaborador` | Zero integração com o roteador (sem deep-link); é aviso, não bloqueio — o gate real fica em `instalacao-obra-store.js`, fora do grupo. |
| Contrato Instalador | `src/contrato-instalador.jsx`/`-store.js`/`-engine.js` | `contratos_instalador`, `contrato_instalador_parcelas`, `instalador_acordos`, `propostas`, `dossier_obra`, `equipamentos_obra`, `documento_signatarios`, `contrato_instalador_distratos` | Tela mais madura do grupo; deep-link completo (`useRotaItem`/`useRouteTab`); vínculo ao instalador é indireto via `instalador_acordos`. |
| Pagamentos a Instaladores | `src/pagamentos-instalador.jsx` (+ `-acordos.jsx`/`-recibos.jsx`) | `contrato_instalador_parcelas`, `decisoes_gerenciais` | Filtro correto por contrato assinado; sem link de volta ao contrato; 2ª fonte de "pago" paralela à do Omie (tela 1). |
| Cronograma de Pagamento da Instalação | `src/entrega.jsx` (`CronogramaPage`) | `instalacao_cronograma` | Isolada do pipeline real: campos Montador/Endereço são texto livre (sem FK), botão "Abrir" sem `onClick`, zero deep-link, único consumidor externo (`project-gates.js`) liga a tabelas legadas já confirmadas mortas em outro ponto do repo. |

---

*(Fim do handoff. Nenhum arquivo de código foi alterado na produção deste documento — é só a investigação já feita, mais o plano de execução organizado por complexidade.)*
