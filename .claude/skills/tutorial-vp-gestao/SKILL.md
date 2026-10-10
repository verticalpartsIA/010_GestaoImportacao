---
name: tutorial-vp-gestao
description: Cria, atualiza e confere os tutoriais do VP Gestão (botão "?" do cabeçalho e da sidebar). Use quando pedirem tutorial de uma tela ou módulo, "acabamos de criar essa tela", "varre os tutoriais", "atualizar tutorial", "checklist de tutoriais", ou quando uma tela mudar e o tutorial precisar ser refeito. Faz varredura por módulo, compara a data do tutorial com a última alteração da tela, herda o mapa de dados entre telas e avalia cada entrega com o Codex antes de publicar.
---

# Tutoriais do VP Gestão

Esta skill é a única fonte de regras para tutoriais. Antes de qualquer ação, leia este arquivo inteiro e depois `references/modulos.md` (árvore de módulos, pastas e arquivos de cada tela) e `references/herancas.md` (quem doa e quem recebe dados).

## 1. O que é o sistema de ajuda (leia antes de escrever qualquer tutorial)

O botão **"?"** tem três partes, e cada uma tem um lugar:

- **"?" do módulo, na sidebar**: fica no título do grupo do menu lateral (ex.: "Geral", "CRM"), à esquerda da setinha de recolher. Abre direto o tutorial de visão do módulo, em nova aba. É o `?` de **pai**. Ligado em `MODULOS_TUTORIAL` (`src/shell.jsx`).
- **"?" da tela, canto superior direito**: fica no cabeçalho de cada tela filha. Abre um menu com três itens:
  1. **Ajuda**: janela com a instrução rápida da tela (`HELP_TOPICS` em `src/shell.jsx`) e perguntas frequentes.
  2. **Treinamento**: abre o tutorial da tela, em nova aba (`TUTORIAIS` em `src/shell.jsx`). Sem tutorial, aparece apagado ("Em breve").
  3. **Enviar feedback**: formulário guiado que vira uma **issue no GitHub**. Campos: tipo (Erro, Dúvida ou Sugestão), gravidade (só para Erro), resumo, o que estava fazendo, o que aconteceu, o que esperava e texto livre. A issue leva só o **primeiro nome** de quem enviou, e o endereço da tela.

**Os colaboradores podem criar as issues sozinhos** pelo "Enviar feedback". Ao documentar uma tela, diga isso no tutorial e explique o passo a passo (abrir o "?", escolher "Enviar feedback", tipo, gravidade, descrever). Feedback é a forma de o time reportar problemas: escreva o caminho, não que "o suporte resolve".

Toda issue nasce com as etiquetas `feedback`, `aguardando-gestor`, o tipo, a gravidade e `tela:<rota>`. O gestor muda para `pronto-para-claude` quando a pessoa for atendida. Não resolva issues `aguardando-gestor`.

## 2. Onde ficam os arquivos

Tudo em `TreinamentoVP/`, organizado por módulo pai e depois por tela:

```
TreinamentoVP/
├── index.html                         ← Central de Ajuda (gerada por indice.mjs)
├── geral/                             ← módulo pai (visão do módulo)
│   ├── index.html  roteiro.json  demo.json  img/
│   ├── dashboard/                     ← tela filha
│   │   ├── index.html  roteiro.json  demo.json  img/
│   ├── inbox/ …
└── contratos-juridico/ …
```

- Só `index.html` de cada tutorial e a Central (`TreinamentoVP/index.html`) vão ao Git. **`roteiro.json`, `demo.json`, `img/` e logs de tutoriais nunca vão ao Git**: a pasta `TreinamentoVP/` é servida sem login. Exceção: `references/exemplo/`, que tem dados fictícios e fica fora da pasta pública.
- Nomes de pasta são os da `references/modulos.md`. Não invente outro nome.

## 3. Modos de trabalho

Identifique o pedido e siga o modo correspondente.

### Modo A: varredura de módulo (ex.: "varre os tutoriais", "checklist")

1. Leia `references/modulos.md` e escolha o módulo (ou todos).
2. Para cada tela do módulo, classifique:
   - **Sem tutorial**: a pasta da tela não existe ou não tem `index.html`.
   - **Desatualizado**: a última alteração de algum arquivo da tela (lista `TELAS` em `scripts/conferir-tutoriais.mjs`) é posterior à data "Atualizado em" do tutorial.
   - **Em dia**: nenhum dos dois.
3. Rode `node scripts/conferir-tutoriais.mjs` na raiz do repo. Ele mostra desatualizações, dado real no texto, links quebrados e tutoriais fora do menu.
4. Responda com o checklist (formato na seção 6), uma linha por tela.
5. **Não crie nem regenere nada sem o pedido do usuário.** A varredura só lê.

### Modo B: tela nova ("acabamos de criar essa tela")

1. Pergunte, se não estiver claro: nome da tela, rota, em qual módulo do menu ela fica, e se ela recebe dados de outra tela.
2. Localize o componente pela rota em `src/app.jsx` (`case "<rota>"`) e o arquivo pelo `references/modulos.md`. Se a tela não estiver na lista, **acrescente-a** na lista de telas do módulo antes de seguir.
3. **Herança**: procure os stores e imports que a tela usa (`grep -n "Store\.\|from('" src/<arquivo>`). Preencha a relação em `references/herancas.md`: quem **doa** dados para esta tela e para quais telas ela **doa**. Se não conseguir confirmar no código, pergunte antes de gravar.
4. Crie **somente o tutorial desta tela**. Não refaça tutoriais de outras telas, mesmo que citem esta.
5. Siga a seção 4 (escrita, captura, conferência, Codex).

### Modo C: atualizar tutorial (tela mudou)

1. Confirme quais arquivos da tela mudaram (`git log -1 --format=%cI -- <arquivo>`) e compare com "Atualizado em".
2. Refaça **só o roteiro dos passos afetados** (pode ser um passo com `--so <id>`). Não edite o `index.html` à mão: regenere pelo `roteiro.json` com `montar.mjs`.
3. Atualize a data "Atualizado em" e siga a seção 4.

### Modo D: tutorial de módulo (visão do módulo)

Só depois que **todas** as telas filhas existirem e estiverem aprovadas. O tutorial de módulo linka as telas filhas e apresenta o módulo. Sem telas filhas prontas, não crie.

## 4. Fluxo de cada tutorial (todos os modos de escrita)

1. **Roteiro**: use `references/roteiro-formato.md` como base e `references/exemplo/` como modelo. Use os textos do código (`window.toast`, títulos de modal, `placeholder`, `HELP_TOPICS`). Nunca invente rótulo de botão.
2. **Dados fictícios**: `demo.json` com `@exemplo.com`, CNPJ/CPF fictícios e nenhum dado real. O app local lê o Supabase de **produção**: `capturar.mjs` só aceita localhost e bloqueia escrita. Nunca aponte para o site publicado.
3. **Captura**: `node .claude/skills/tutorial-vp-gestao/scripts/capturar.mjs TreinamentoVP/<modulo>/<tela>/roteiro.json --base http://localhost:3000`. Abra cada PNG e confira: destaque no elemento certo, sem tela em "Carregando…", sem dado real.
4. **Montagem**: `montar.mjs` gera o `index.html`. Depois `indice.mjs TreinamentoVP` e `embutir-miniaturas.mjs TreinamentoVP`, nesta ordem.
5. **Conferência**: `node scripts/conferir-tutoriais.mjs` precisa passar. O único aviso aceito é o de tutorial ainda fora do menu, quando a ligação não foi pedida.
6. **Avaliação pelo Codex** (seção 5). Só publica se a nota atingir o mínimo.
7. **Entrega**: branch novo a partir de `origin/main`, só `index.html` e os arquivos de código alterados. PR com descrição. **Merge só com "Confirmo" do usuário.**

## 5. Avaliação pelo Codex (nota e recusa)

O plugin Codex **revisa** código; ele não dá nota. A nota é desta skill, e o Codex é o avaliador independente:

1. Chame a skill `codex:rescue` com o pedido: revisar o tutorial contra o código da tela, usando a rubrica abaixo, e devolver nota de 0 a 10 com os erros encontrados (texto, passo, print).
2. **Rubrica (10 pontos):**
   - Fidelidade ao código: rótulos, rotas e comportamentos conferem com o `.jsx` (3 pontos).
   - Prints: destaque no alvo certo, sem dado real, sem tela incompleta (2 pontos).
   - Texto para leigo: frases curtas, um passo por ação, sem jargão interno (2 pontos).
   - Ajuda e feedback: explica o "?" quando couber e o passo do "Enviar feedback" (1 ponto).
   - Herança e links: relações de `herancas.md` corretas e links "próximos passos" válidos (2 pontos).
3. **Nota mínima para publicar: 7.** Abaixo de 7, **recuse a entrega**, anote os erros e refaça. No máximo duas rodadas de refação. Depois disso, avise o usuário com o que falta.
4. Registre a nota no checklist (seção 6).

## 6. Checklist (formato de resposta)

Responda sempre neste formato, uma linha por tela:

```
Módulo Geral
  ✔ Dashboard — em dia (tutorial 09/10, última alteração 05/10)
  ✘ Inbox — desatualizado (tela mudou 10/10, tutorial 04/10) → regerar
  ◻ Notificações — sem tutorial → criar
  ⏸ Prazos & Pendências — aguarda decisão do usuário
Próximo: Inbox (regerar). Você diz "faça" para seguir.
```

Use "Esse já fiz", "Terminei", "Vou pra tal" como a pessoa pedir. Não marque como feito o que não foi publicado.

## 7. Ligações no app (`src/shell.jsx`)

Tutorial novo precisa de uma linha em `TUTORIAIS` (rota → caminho, ex.: `"inbox": "geral/inbox"`), e tutorial de módulo de uma linha em `MODULOS_TUTORIAL` (rótulo do grupo → pasta do módulo). Alterar `shell.jsx` é mudança de código: **só com o pedido explícito do usuário**, e precisa subir o `?v=` do `shell.jsx` em `index.html`.

## 8. Regras que não podem ser quebradas

- Não altere código do app além da ligação acima. Problema achado no app: abra issue **só com "CONFIRMO"** do usuário.
- Nunca commite roteiro, demo, img ou log de tutorial dentro de `TreinamentoVP/`.
- Nenhum dado real em tutorial público.
- Nada de link quebrado: "próximos passos" só aponta para tutorial publicado.
- Nunca use `sleep` em primeiro plano. Capturas longas rodam em segundo plano.
- Não contorne o break-glass do Supabase nem use credenciais pessoais.
- Merge só com "Confirmo".
