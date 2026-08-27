# CLAUDE.md — contexto para retomar este projeto

Notas operacionais para uma sessão futura do Claude Code neste repo. O README.md tem a visão de produto/telas; este arquivo é sobre "como trabalhar aqui".

## Acessos confirmados (sessão de 2026-07-16)

- **GitHub**: `verticalpartsIA/010_GestaoImportacao` — leitura/escrita completas (commits, PRs, issues, Actions) via MCP `github`.
- **Supabase** projeto `jxtqwzmpgofwctqajewt` (nome interno "vpprd") — leitura/escrita completas via MCP `Supabase`/`SupabaseEscamax`.
- **Deploy de produção**: `https://vpgestaoimportacao.vpsistema.com` (domínio mudou de `vpprd.vpsistema.com` em algum momento de 2026-07 — o README ainda cita o domínio antigo, revisar se relevante).
  - Mecanismo real: **integração nativa Git do hPanel** (Hostinger) — "Conectado com GitHub" + "Implantação automática", dispara sozinho a cada push em `main`. Confirmado funcionando.
  - Existe também um workflow `.github/workflows/deploy.yml` (SSH via GitHub Actions) — é **redundante**, criado numa sessão anterior antes de confirmar que a integração nativa funcionava. Não removido a pedido do usuário ("deixar como está por enquanto"). Se voltar a falhar, não é crítico — o deploy real é via hPanel.
  - Existe um Claude Code rodando diretamente na VPS/Hostinger do usuário (sessão separada, sem relação com esta) — o usuário às vezes pede diagnósticos rodados por ele via SSH real na máquina.

## ⚠️ Cache-busting (`?v=`) — NUNCA esquecer disto

Todo `<script>`/`<link>` do `index.html` é servido com `?v=N` (ex.: `ficha-tecnica.jsx?v=18`). **Sempre que editar um arquivo referenciado assim, incremente esse número no `index.html` no mesmo commit.** Esquecer isso quebra produção silenciosamente: quem já tinha o arquivo em cache continua rodando a versão antiga, mesmo depois do deploy — e o erro só aparece depois, tipo `TypeError: can't access property "X", window.FT.Y is undefined`, difícil de ligar à causa na hora. Já aconteceu nesta sessão (esqueci de bumpar `ficha-tecnica-engine.js`/`store.js`/`.jsx`/`.css` em 3 commits seguidos antes de perceber — PR #31 foi só pra corrigir isso). Checklist antes de considerar uma mudança em `src/*.js`/`*.jsx` ou `styles/*.css` "pronta": grep o nome do arquivo em `index.html` e confirma que o `?v=` mudou.

## Stack / como testar localmente

- React 18 UMD + Babel Standalone + Supabase JS + jsPDF + html2canvas, todos via **CDN** (unpkg, jsdelivr, cdnjs) — **sem build step**.
- `node server.js` sobe um Express simples servindo estático em `:3000`. `npm install` primeiro (node_modules não commitado).
- **Atualização 20/08**: a suposição abaixo ("sandbox sem acesso a CDNs/Supabase real") não é mais verdadeira nesta sessão — CDNs externos (unpkg, esm.sh, jsDelivr, cdnjs) e o Supabase real do projeto responderam normalmente via `mcp__Claude_Browser__*` e via `curl`/`WebSearch`. Pode ter sido uma limitação de um ambiente/sessão anterior, não uma regra permanente — **confirme de novo antes de assumir uma limitação de rede**, não herde isso cegamente. O passo a passo do Playwright abaixo continua útil se algum dia a rede estiver bloqueada de novo.
- Ambiente sandbox sem acesso a CDNs externos nem ao Supabase real (suposição antiga — ver atualização acima) — REST calls do Supabase a partir do browser falhariam silenciosamente, capturadas pelos próprios catch/warn do código. Para testar o app de verdade com Playwright/Chromium nesse cenário:
  1. `npm install` localmente as libs equivalentes (react, react-dom, @babel/standalone, @supabase/supabase-js, jspdf, html2canvas) numa pasta de scratch.
  2. Usar `page.route()` no Playwright pra interceptar as 6 URLs de CDN do `index.html` e servir os arquivos locais no lugar. Cuidado com a ordem de registro das rotas — Playwright roda a ÚLTIMA registrada primeiro; usar `route.fallback()` (não `route.continue()`) se precisar cair pra uma rota registrada antes.
  3. Tirar `integrity=`/`crossorigin=` do HTML servido (senão o SRI barra os arquivos locais, que não batem o hash).
  4. Bloquear todo o resto de `https://` externo (Supabase REST etc. vão falhar mesmo, sem problema — o app funciona com dev bypass local).
  5. `src/supabase.js` tem bypass de auth para `localhost`/`127.0.0.1` — cria um `dev@localhost` fake, não precisa de SSO real.
  6. Como o Supabase real é inalcançável, qualquer teste que dependa de dados da "biblioteca" compartilhada (ver seção Ficha Técnica abaixo) precisa injetar mock direto via `page.evaluate(() => window.FT.setLibraryExtras({cats:[...], campos:[...]}))` depois do load — sem isso, `state.cats` só terá as 9 categorias nativas.
- Isso vale o esforço: peguei vários bugs reais (não hipotéticos) só rodando o app de verdade em vez de confiar na leitura do código.

## ⚠️ Única exceção ao "sem build step": `pdf-bundle/` (Vite)

Migração de geração de PDF pra `@react-pdf/renderer` (plano aprovado pelo usuário 20/08, Fase 1 = RFQ/Solicitação de Cotação). **Caminho A (CDN ESM sem bundler, ex. esm.sh/jsDelivr) foi testado e travou de verdade** — `pdf().toBlob()` sempre falhava com `Cannot read properties of null (reading 'props')`, em 2 CDNs diferentes, com e sem instância de React pareada (falha conhecida do próprio `@react-pdf/renderer` v4 fora de um bundler real — ver `diegomura/react-pdf` issues #3223/#3156). O usuário escolheu então o Caminho B.

- `pdf-bundle/pedido-fornecedor-reactpdf.entry.js` — fonte real (JSX/ES modules, `@react-pdf/renderer` importado normal via npm).
- `pdf-bundle/vite.config.js` — build em modo lib, formato `iife`, `react`/`react-dom` como **external** (resolvidos pro `window.React` que o app já carrega via CDN — sem isso, duas cópias de React coexistindo quebram o reconciler do react-pdf).
- Rodar `npm run build:pdf` sempre que editar o `.entry.js` — gera `src/pedido-fornecedor-reactpdf.bundle.js` (~1.3MB), que é **commitado** (é o asset estático servido, igual jsPDF/html2canvas — o app em produção continua sem build step nenhum, só a *geração* desse um arquivo usa Vite localmente).
- Pegadinhas reais encontradas (documentadas como comentário no `.entry.js` também):
  - O reconciler do react-pdf **não ignora `null`** num array de filhos como o React DOM faz — `cond ? h(...) : null` sobrevivendo no array quebra com `Cannot read properties of null (reading 'props')`. Sempre filtrar (`.filter(Boolean)`) antes de passar array de filhos.
  - Saída IIFE sem processo Node por trás — precisa de `define: {'process.env.NODE_ENV': ...}` no `vite.config.js`, senão quebra com `process is not defined` assim que carrega.
  - `@fontsource/inter` (CDN jsDelivr, URLs estáveis/versionadas — melhor que gstatic direto, que muda hash) não publica arquivo itálico — registrar só os pesos/estilos que existem de verdade, senão `Font.register` falha silenciosamente até o render (`Could not resolve font`).
- Próximas fases (Ficha Técnica, depois Contrato Venda+Instalador juntos via `assinar-app.jsx`, Proposta por último) devem reusar esse mesmo padrão de `pdf-bundle/<nome>.entry.js` + entrada em `vite.config.js` ou `package.json#scripts`.

## Módulo Ficha Técnica (`src/ficha-tecnica.jsx` + `-engine.js` + `-store.js` + `styles/ficha-tecnica.css`)

Gerador de ficha técnica de produto (preview em tela + PDF via `html2canvas`+`jsPDF` + impressão nativa). Trabalho feito (todo mergeado em `main`):
- Adicionado campo **Descrição DUIMP** ao documento gerado (issue #24, PR #23), rótulo "Descrição" → "Descrição Comercial" (PR #25).
- **Suporte a múltiplas páginas** (PR #26, corrigido no #27): a ficha era travada em exatamente 1 página A4 com `overflow:hidden` — cortava conteúdo em silêncio, inclusive o rodapé (bug real: rodapé não era bloco protegido no algoritmo de corte, causando perda de conteúdo por arredondamento). Agora cresce naturalmente; paginação trata cada grupo/descrição/rodapé como bloco indivisível. Rodapé mostra "· Criado por {email}" pequeno (`window.__VP_USER.email`).
  - **Cuidado se mexer na paginação de novo**: depende de `.ft-fz-grp`, `.ft-fz-descterm`, `.ft-fz-ident`, `.ft-fz-footer` como marcadores de bloco protegido (dentro do botão "Salvar PDF" em `ficha-tecnica.jsx`). Nova seção visual que deva ficar inteira numa página → adicionar a classe dela no `querySelectorAll(...)`.
- **Categorias/campos customizados — biblioteca compartilhada** (issue #33, PRs #30/#31/#32):
  - Tabelas `fichas_lib_categorias` / `fichas_lib_campos` no Supabase guardam categorias/campos que qualquer usuário cria (via "+ Nova categoria" / "+ Adicionar campo") — mesclados com as 9 categorias nativas (`window.FT.LIB` em `ficha-tecnica-engine.js`) toda vez que uma ficha nova abre (`freshCats()`).
  - **`fichas_tecnicas.cats` é um snapshot jsonb independente por ficha** — ao reabrir uma ficha salva, usa `ficha.cats` direto, nunca re-mescla com a biblioteca. Ou seja: mudar/limpar a biblioteca compartilhada **nunca afeta fichas já salvas**, só o que fichas **novas** vão oferecer.
  - `custom: true` marca categoria/campo não-nativo. `window.FT.PROTECTED_CUSTOM_CATS` é uma lista de exceção (hoje só `c_madeira_test` = "Compatível com Fabricante") pra categorias customizadas que devem ficar protegidas mesmo assim (sem botão de excluir) — por decisão explícita do usuário, não por regra automática.
  - `addCategory`/`addField` bloqueiam nome duplicado (`window.FT.normalizeNome` — sem acento/case) contra as categorias/campos já existentes (nativos + biblioteca). Recalcula `freshCats()` na hora do clique em vez de confiar só em `state.cats`, pra não falhar se a ficha abriu antes da biblioteca terminar de carregar.
  - Bug histórico já corrigido: o `id`/`k` gerado por `window.FT.slug()` tinha sufixo aleatório, então a checagem antiga (por id, não por nome) nunca via duplicata — foi assim que "Cor" e "Observações" viraram várias entradas. Se algo parecido reaparecer, suspeitar de novo desse padrão.

## Fluxo de trabalho estabelecido nesta sessão

- Branch de trabalho: `claude/project-setup-check-atzlcv`. Fluxo: commit → push → abrir PR → squash merge em `main` (autorizado pelo usuário nesta sessão).
- **Cuidado com squash merge repetido no mesmo branch**: depois de várias rodadas de PR+squash no mesmo branch de longa duração, o histórico local diverge do squash já aplicado em `main` e o próximo PR pode dar "merge conflict" mesmo sem conflito de conteúdo real. Solução: `git checkout -B <branch> origin/main && git cherry-pick <commit-novo> && git push --force-with-lease`. Repetiu ~4x nesta sessão, sempre funcionou.
- **Outras sessões push no mesmo branch em paralelo** — aconteceu uma vez (commit sobre "republicar no Omie" apareceu no remoto sem eu saber). Antes de resetar pro `origin/main` na hora do cherry-pick, sempre `git fetch` e conferir `git log origin/<branch>..HEAD`/`HEAD..origin/<branch>` pra não perder trabalho de outra sessão — nesse caso, `git rebase origin/<branch>` (não reset pra main) resolveu sem conflito.
- Usuário pede para eu confirmar diagnóstico/plano antes de mexer em código quando a mudança é visual/de produto/estrutural (ex.: categorias); para bugs técnicos claros costuma autorizar direto.
- Documento o trabalho feito criando issues no GitHub já fechadas (#24, #33), com "o que foi feito / por que / propósito" — o usuário gosta desse registro e pede explicitamente no fim de cada assunto. `issue_write` com `state: closed` no `create` não fecha de verdade (bug da API/tool) — sempre confirmar com `issue_read` depois e, se necessário, rodar um `update` explícito com `state: closed`.

## Pendências / observações em aberto

- `deploy.yml` (workflow SSH redundante) continua sem uso real — usuário optou por não mexer.
- Não testei o fluxo real de upload de mídia (Supabase Storage) fim-a-fim — só simulei com dataURL local, já que upload real precisa de rede que o sandbox não tem.
- **Perguntar depois (pedido em 2026-08-27, aguardando "Faça")**: estruturar o campo `container_no` da resposta do fornecedor (`cotacoes_elevador_fornecedor.respostas.container_no`, hoje texto livre único, ex. `"1x40HC + 1x20GP"`) em tipo/quantidade por container, e conectar esse dado ao módulo Embarques-Importação (`src/embarques-importacao.jsx`, componente `EIContainers` já suporta múltiplos containers estruturados). Contexto: confirmado nesta sessão que o formulário público (`cotacao-elevador-fornecedor.jsx`) já captura esse campo corretamente e ele aparece no modal interno "Ver resposta do fornecedor" (`formulario-elevador.jsx` `FECotacaoRespostaModal`) — mas não flui pra Precificação (`precificacao-elevador.jsx`/`-store.js`) nem pra Embarques hoje.
