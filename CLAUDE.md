# CLAUDE.md — contexto para retomar este projeto

Notas operacionais para uma sessão futura do Claude Code neste repo. O README.md tem a visão de produto/telas; este arquivo é sobre "como trabalhar aqui".

## Acessos confirmados (sessão de 2026-07-16)

- **GitHub**: `verticalpartsIA/010_GestaoImportacao` — leitura/escrita completas (commits, PRs, issues, Actions) via MCP `github`.
- **Supabase** projeto `jxtqwzmpgofwctqajewt` (nome interno "vpprd") — leitura/escrita completas via MCP `Supabase`/`SupabaseEscamax`.
- **Deploy de produção**: `https://vpgestaoimportacao.vpsistema.com` (domínio mudou de `vpprd.vpsistema.com` em algum momento de 2026-07 — o README ainda cita o domínio antigo, revisar se relevante).
  - Mecanismo real: **integração nativa Git do hPanel** (Hostinger) — "Conectado com GitHub" + "Implantação automática", dispara sozinho a cada push em `main`. Confirmado funcionando.
  - Existe também um workflow `.github/workflows/deploy.yml` (SSH via GitHub Actions) — é **redundante**, criado numa sessão anterior antes de confirmar que a integração nativa funcionava. Não removido a pedido do usuário ("deixar como está por enquanto"). Se voltar a falhar, não é crítico — o deploy real é via hPanel.
  - Existe um Claude Code rodando diretamente na VPS/Hostinger do usuário (sessão separada, sem relação com esta) — o usuário às vezes pede diagnósticos rodados por ele via SSH real na máquina.

## Stack / como testar localmente

- React 18 UMD + Babel Standalone + Supabase JS + jsPDF + html2canvas, todos via **CDN** (unpkg, jsdelivr, cdnjs) — **sem build step**.
- `node server.js` sobe um Express simples servindo estático em `:3000`. `npm install` primeiro (node_modules não commitado).
- **Ambiente sandbox sem acesso a CDNs externos** (só a hosts específicos como npm registry/pypi). Para testar o app de verdade com Playwright/Chromium neste tipo de ambiente:
  1. `npm install` localmente as libs equivalentes (react, react-dom, @babel/standalone, @supabase/supabase-js, jspdf, html2canvas) numa pasta de scratch.
  2. Usar `page.route()` no Playwright pra interceptar as 6 URLs de CDN do `index.html` e servir os arquivos locais no lugar.
  3. Tirar `integrity=`/`crossorigin=` do HTML servido (senão o SRI barra os arquivos locais, que não batem o hash).
  4. Bloquear todo o resto de `https://` externo (Supabase REST etc. vão falhar mesmo, sem problema — o app funciona com dev bypass local).
  5. `src/supabase.js` tem bypass de auth para `localhost`/`127.0.0.1` — cria um `dev@localhost` fake, não precisa de SSO real.
- Isso vale o esforço: peguei pelo menos 2 bugs reais (não hipotéticos) só rodando o app de verdade em vez de confiar na leitura do código.

## Módulo Ficha Técnica (`src/ficha-tecnica.jsx` + `styles/ficha-tecnica.css`)

Gerador de ficha técnica de produto (preview em tela + PDF via `html2canvas`+`jsPDF` + impressão nativa). Trabalho recente (todo mergeado em `main`):
- Adicionado campo **Descrição DUIMP** ao documento gerado (issue #24, PR #23).
- Rótulo "Descrição" → "Descrição Comercial" (PR #25).
- **Suporte a múltiplas páginas** (PR #26, depois corrigido no PR #27): a ficha era travada em exatamente 1 página A4 com `overflow:hidden` — cortava conteúdo em silêncio. Agora cresce naturalmente e o "Salvar PDF" pagina de verdade, tratando cada grupo de specs/descrição/rodapé como bloco indivisível (nunca corta um bloco ao meio entre páginas).
- **Cuidado se mexer na paginação de novo**: o algoritmo em `ficha-tecnica.jsx` (dentro do botão "Salvar PDF") depende de `.ft-fz-grp`, `.ft-fz-descterm`, `.ft-fz-ident`, `.ft-fz-footer` como marcadores de bloco protegido. Se adicionar uma nova seção visual na ficha que deva ficar inteira numa página, adicionar a classe dela nessa lista (`querySelectorAll(...)`).
- Rodapé mostra "· Criado por {email}" pequeno, lido de `window.__VP_USER.email`.

## Fluxo de trabalho estabelecido nesta sessão

- Branch de trabalho: `claude/project-setup-check-atzlcv`. Fluxo: commit → push → abrir PR → squash merge em `main` (autorizado pelo usuário nesta sessão).
- **Cuidado com squash merge repetido no mesmo branch**: depois de várias rodadas de PR+squash no mesmo branch de longa duração, o histórico local diverge do squash já aplicado em `main` e o próximo PR pode dar "merge conflict" mesmo sem conflito de conteúdo real. Solução: `git checkout -B <branch> origin/main && git cherry-pick <commit-novo> && git push --force-with-lease`.
- Usuário pede para eu confirmar diagnóstico/plano antes de mexer em código quando a mudança é visual/de produto; para bugs técnicos claros costuma autorizar direto.
- Documentei o trabalho feito criando issues no GitHub já fechadas (ex.: #24), com "o que foi feito / por que / propósito" — o usuário gosta desse registro.

## Pendências / observações em aberto

- `deploy.yml` (workflow SSH redundante) continua sem uso real — usuário optou por não mexer.
- Não testei o fluxo real de upload de mídia (Supabase Storage) fim-a-fim — só simulei com dataURL local, já que upload real precisa de rede que o sandbox não tem.
