# Sidebar do hub — polimento visual + busca Ctrl K (piloto)

> **Status:** plano (SDD: Specify → Clarify → Plan → Tasks → Analyze). **Nada implementado.** Só se implementa depois das respostas do Clarify e de pedido explícito do Gelson (Arts. 7, 37, 39).
> **Origem:** análise do conceito "Glassy SideBar V5" + mock estático `mock-sidebar-vp.html` aprovado pelo Gelson em 05/11/2026.
> **Selos (Art. 6):** o que está marcado **Conferido (05/11/2026, leitura do código)** foi lido em `src/shell.jsx` e `styles/app.css`; o que não tem selo é **Não verificado**.

## 1. Specify

### 1.1 Achado que reduz o escopo
O mock parece muito mais novo do que é: a sidebar real **já tem** boa parte dele. **Conferido (05/11/2026, código):**

| Item do mock | Situação hoje |
|---|---|
| Item ativo arredondado com fundo amarelo translúcido | **Já existe** (`app.css`, `.nav-item.is-active`, gradiente amarelo, raio 10 px) |
| Modo compacto só com ícones + tooltip | **Já existe** (`data-sidebar="collapsed"`, 64 px, tooltip por `data-tooltip`) |
| Grupos recolhíveis, lembrados no navegador | **Já existe** (`vp_sidebar_collapsed_groups`) |
| Contador de Decisões pendentes | **Já existe** (`DecisoesStore.listarPendentesParaMim`) |
| Perfil no rodapé, versão publicada, "?" por módulo | **Já existe** |
| Compactar sozinha abaixo de 1024 px | **Já existe** (`app.jsx`) |
| Transição da largura | **Já existe** (`grid-template-columns` animado) |
| Filtro por perfil (`restrict`) e por alocação de grupos | **Já existe** (`filterVisible`, `grupoVisivel`) |
| **Busca de telas / Ctrl K** | **Não existe** (nenhuma ocorrência em `shell.jsx`/`app.jsx`) |
| **Contador em Notificações e Inbox** | Não existe; só Decisões tem. Origem do dado: Não verificado |
| **Menu deslizante no celular** (hoje só vira ícones) | Não existe |
| **Respeitar `prefers-reduced-motion`** | Não encontrado em `app.css` (Não verificado fora dele) |
| **Modo vidro / painel flutuante** | Não existe (fora do escopo, ver 1.3) |

### 1.2 Requisitos
- **FR01 — Busca de telas.** Campo no topo da sidebar e atalho **Ctrl/⌘ K** abrem uma paleta que lista só as telas que a pessoa **pode ver** (mesmos `filterVisible` + `grupoVisivel` do menu). Filtra por nome da tela e do módulo, setas/Enter/Esc, Enter navega.
- **FR02 — Contadores.** Notificações (não lidas) e Inbox (não lidos) mostram contador como Decisões, **se** houver fonte barata e já existente (ver Clarify 3).
- **FR03 — Acabamento.** Ajuste fino do visual já existente na direção do mock (espaçamento, barrinha lateral do item ativo, tooltip, foco visível), sem mudar a estrutura.
- **FR04 — Movimento.** `prefers-reduced-motion` desliga as transições da sidebar.
- **FR05 — Celular (opcional, Clarify 4).** Abaixo de ~700 px a sidebar vira painel deslizante com fundo escurecido e fecha ao navegar.

### 1.3 Fora do escopo (decisão de projeto, não esquecimento)
- **Modo vidro / painel flutuante:** o fundo do conteúdo é liso (`--vp-gray-50`), não há o que desfocar, e a margem tira área de tabelas largas. Fica como possibilidade futura atrás de variável CSS, **não** neste piloto.
- Mudar `NAV_GROUPS`, rotas, URLs, `id` de alçada ou regras de `restrict`/alocação.
- Sidebar compartilhada com vpsistema/satélites (é outro projeto).
- Biblioteca nova (React Router, Framer Motion, Lucide): contraria o Art. 18. Ícones continuam os `Icon.*` existentes.
- Tema claro/escuro: **não encontrei** mecanismo de tema no hub (`data-theme` sem ocorrência em `app.jsx`/`shell.jsx`/`app.css`); não se cria sistema de tema só para isto.
- Banco, migrations, Edge Functions: nenhum.

### 1.4 Cenários de aceitação
- **Dado** um usuário sem alocação em "Financeiro & Preços", **quando** digita "precif" na busca, **então** a tela não aparece.
- **Dado** a paleta aberta, **quando** digita "prop" e aperta Enter, **então** abre Propostas e a sidebar marca o item ativo, com a URL correta.
- **Dado** o foco num campo de texto de um formulário, **quando** a pessoa usa Ctrl K, **então** a paleta abre sem apagar o que foi digitado (Clarify 2).
- **Dado** a sidebar compacta, **quando** abre a paleta pelo ícone de busca, **então** funciona igual à expandida.
- **Dado** "reduzir movimento" ativo no sistema, **então** nada anima.

## 2. Clarify (perguntas numeradas, responder antes do Plan virar código)

1. **Piloto leve confirmado?** Sem vidro e sem painel flutuante (seção 1.3)? *Recomendo sim.*
2. **Ctrl K dentro de campos de texto:** abrir sempre, ou só fora de campos? Hoje não sei se algum formulário já usa esse atalho (Não verificado). *Recomendo abrir sempre, pois Ctrl K não escreve nada em campo de texto.*
3. **Contadores de Notificações e Inbox:** quer incluir? Preciso conferir se há contagem barata (a Central de Alertas e o Inbox hoje carregam listas inteiras). *Recomendo incluir só se a contagem sair de uma consulta leve; senão, ficam para depois.*
4. **Celular:** incluir o painel deslizante agora, ou deixar o comportamento atual (vira ícones)? O hub é usado no celular por quem? (Vistoria e Separação têm telas próprias.) *Recomendo deixar de fora neste piloto.*
5. **Busca também por palavras-chave** (ex.: "NF" achar Emissão de NF) ou só pelo nome? *Recomendo só nome + módulo agora.*
6. **O texto "Online" no cabeçalho** do mock não existe no hub: manter só o logotipo atual?

## 3. Plan

**Arquivos (Conferido que existem):** `src/shell.jsx` (v139 no `index.html`), `styles/app.css` (v37). Código novo em arquivos pequenos (Art. 21):
- `src/sidebar-busca-calc.js` — função pura: dado `NAV_GROUPS` já filtrado e um texto, devolve resultados ordenados (nome da tela primeiro, depois módulo; sem acento/maiúscula). Testável em Node (Art. 20).
- `src/sidebar-busca.jsx` — componente da paleta (`window.SidebarBusca`), recebe a lista **já filtrada** por permissão do `Sidebar` (não reimplementa autorização, Art. 25 do mock / "não duplicar regras").
- `styles/sidebar-busca.css` — estilos da paleta.
- `src/shell.jsx` — só: campo de busca no topo, atalho Ctrl/⌘ K, passar a lista filtrada, `setRoute(item.id)` ao escolher (padrão do Art. 22: nunca `VpRouter.navigate` sozinho).
- `styles/app.css` — ajustes de FR03/FR04 no bloco da sidebar.

**Regras de segurança:** a lista da busca sai da **mesma** expressão que desenha o menu (`NAV_GROUPS.filter(grupoVisivel)` + `filterVisible`). Esconder na UI é conveniência; a autorização real continua nas rotas/RLS (Art. 25).

**Cache-busting (Art. 19):** subir `?v=` de `shell.jsx` e `app.css` no `index.html`, comparando com `origin/main` na hora; os 2 arquivos novos entram com `?v=1`. `index-print.html` usa `Sidebar`? (grep achou "Sidebar" só em `app.jsx`/`shell.jsx` etc.; conferir se alguma página `.html` além do `index.html` carrega `shell.jsx`.)

**Documentos (Arts. 42, 46, 52):** registrar a mudança em `docs/modulos/01_geral.md` (PC-9, padrões de navegação), rodar `npm run rag` e commitar `docs/rag/`; o texto de ajuda do "?" não muda (a sidebar não é tela de módulo); se houver tutorial que descreva o menu, pedir regeneração à sessão de tutoriais (não editar HTML à mão).

## 4. Tasks (pequenas, em ordem)

- **T001** Responder o Clarify (Gelson).
- **T002** `sidebar-busca-calc.js` + teste de unidade (`sidebar-busca-calc.test.js`): acento/maiúscula, vazio, sem resultado, item de subcabeçalho (`subheader`) e `planned` nunca aparecem, ordenação.
- **T003** `sidebar-busca.jsx` + `sidebar-busca.css`: paleta (setas, Enter, Esc, clique fora, foco preso, `role="dialog"`, `aria-activedescendant`).
- **T004** Integrar no `shell.jsx`: campo no topo (ícone só no compacto), atalho Ctrl/⌘ K, lista filtrada por permissão.
- **T005** FR03/FR04 em `app.css` (barrinha do item ativo, foco visível, `prefers-reduced-motion`).
- **T006** (se Clarify 3 = sim) contadores de Notificações/Inbox com consulta leve; mesmo ciclo de atualização do badge de Decisões (3 min + evento).
- **T007** (se Clarify 4 = sim) painel deslizante no celular.
- **T008** Testes: `npm test`; `node scripts/check-cache-bust.js origin/main`; e2e novo `e2e/sidebar-busca.spec.js` (Ctrl K abre, filtra, navega, Esc fecha, compacto); `npm run test:e2e`; `npm run lint`.
- **T009** Abrir de verdade no navegador (Art. 34): expandida, compacta, paleta, usuário **sem** alocação de um grupo (simulando `window.__VP_USER.gruposAlocados`), tela estreita. Relatar o que **não** foi testado.
- **T010** Docs: `01_geral.md` PC-9, `npm run rag`, commit dos derivados.

## 5. Analyze (riscos e conflitos)

- **Constituição:** Art. 18 (sem build/biblioteca nova) respeitado; Art. 19 (cache-busting) e Art. 22 (`setSubsel`/`setRoute`) são pontos de atenção em T004; Art. 21 respeitado (arquivos novos pequenos; `shell.jsx` só ganha a integração).
- **Concorrência (Art. 17):** `shell.jsx` e `app.css` são tocados por várias sessões (há muitas notas "→ módulo" apontando para eles). Antes de implementar: `git fetch`, comparar, nunca sobrescrever; bump de `?v=` conferido contra `origin/main`.
- **Risco do atalho:** Ctrl K pode colidir com atalho do navegador (Firefox/Chrome usam Ctrl K para barra de busca em alguns contextos) ou de outro componente; `preventDefault` só com a paleta disponível. Verificar em T009.
- **Risco de vazamento:** busca mostrar tela fora de permissão. Mitigação: lista vem da mesma filtragem do menu + teste dedicado (cenário 1).
- **Contadores:** consulta pesada a cada navegação degradaria o hub (Notificações/Inbox carregam listas). Por isso T006 é condicional.
- **Visual:** os ajustes de FR03 mexem em CSS compartilhado por todas as telas via grid (`--sidebar-w`); validar que tabelas largas e modais não mudam de posição.
- **Divergências a avisar (Art. 12):** nenhuma entre código e `01_geral.md` encontrada nesta leitura, mas **não li** o PC-9 inteiro; conferir antes de escrever lá.

## 6. Entrega
Tudo local no Git até o Gelson pedir commit/PR/merge (Art. 39); branch de trabalho, nunca direto na `main`; merge é produção.
