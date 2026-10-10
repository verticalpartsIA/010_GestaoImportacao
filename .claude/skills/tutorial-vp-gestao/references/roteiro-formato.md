# Formato do `roteiro.json`

Um arquivo por tutorial. Os mesmos campos alimentam a captura (`capturar.mjs`) e a página (`montar.mjs`).

## Nível do tutorial

| Campo | Tipo | Uso |
|---|---|---|
| `titulo` | texto | Tarefa no infinitivo: "Cadastrar um novo lead". Vira o H1. |
| `modulo` | texto | Como no breadcrumb do app: "CRM · Leads", "Gestão de Importação · P.I.". A parte antes de `·` agrupa na Central de Ajuda. |
| `resumo` | texto | 1 frase: o que é e por que importa. |
| `perfil` | `comercial` \| `engenharia` \| `financeiro` \| `admin` | Perfil simulado na captura e exibido na página. Padrão `admin`. |
| `tempo` | texto | "3 minutos". |
| `antes` | lista de textos | Pré-requisitos ("Antes de começar"). Aceita mini-Markdown. |
| `resultado` | texto | Bloco "Pronto!" — o que o usuário tem agora + próximo passo. |
| `problemas` | lista `{pergunta, resposta}` | "Problemas comuns" (accordion). Tire das validações/toasts do código. |
| `relacionados` | lista `{titulo, link}` | "Próximos passos". Links relativos: `../<outro-slug>/index.html`. |

## Mapa "De onde vem e para onde vai" (opcional, recomendado)

Campo `mapa` no nível do tutorial. `montar.mjs` desenha, antes dos passos, um infográfico **Herda de → Esta tela → Doa para**, um workflow numerado e uma árvore (ramos e galhos). Os fatos devem vir do código.

| Campo | Tipo | Uso |
|---|---|---|
| `titulo` | texto | Padrão: "De onde esta tela vem e para onde ela leva". |
| `intro` | texto (mini-Markdown) | 2–4 frases para leigo explicando "herda" e "doa". |
| `nome` / `sub` | texto | Nome da tela e "Grupo › Botão" da sidebar. |
| `herda` | lista `{de, dado, tipo?}` | De onde os dados vêm (quem grava/alimenta). `tipo` = etiqueta curta. |
| `doa` | lista `{para, dado, tipo?}` | Para onde os dados vão (quem lê, telas de destino, contadores). |
| `fluxo` | lista de textos | Workflow: o caminho de um dado, do começo ao fim (4–7 etapas). |
| `banco` | lista `{nome, uso}` | Tabelas/armazenamentos (bloco recolhido "para a área técnica"). |

Itálico `*texto*` agora é suportado no mini-Markdown (além de `**negrito**`).

## Captura

| Campo | Padrão | Uso |
|---|---|---|
| `baseUrl` | `http://localhost:3000` | Só aceita localhost (o `--base` da linha de comando tem prioridade). |
| `saida` | `img` | Pasta dos PNGs e do `manifesto.json`, relativa ao roteiro. |
| `largura` / `altura` | 1440 / 900 | Viewport em px CSS. |
| `escala` | 2 | `deviceScaleFactor` — 2 deixa os prints nítidos em telas retina. |
| `dadosDemo` | — | Caminho de um JSON `{ "<tabela>": [linhas] }`. Responde as leituras do Supabase com esses dados (tabela ausente → `[]`) e simula as escritas. **Recomendado sempre.** Com ele o desfoque fica desligado (dados já são fictícios). |
| `filtrarDemo` | `false` | `true` faz o mock do `dadosDemo` aplicar filtros do Supabase (`eq`, `neq`, `in`, `is`, `not.*`, `gt/gte/lt/lte`), `order` e `limit`. Necessário quando a tela lê a mesma tabela com filtros diferentes (ex.: decisões pendentes × decididas). `or=`/`and=` não são avaliados. |
| `simularEscrita` | `false` | Sem `dadosDemo`: em vez de bloquear, responde escritas com 200 falso. |
| `rpcLeitura` | `[]` | Nomes de funções `rpc/` que são só leitura e podem passar (sem `dadosDemo`). |
| `desfocar` | cpf, cnpj, email, telefone = `true`; valores, nomesPessoas = `false` | Liga/desliga cada padrão de desfoque por texto. |
| `desfocarSeletores` | `[]` | Seletores CSS sempre desfocados (ex.: coluna de cliente). |
| `esconder` | bolha do Copiloto, avisos de versão | Seletores extras a esconder do print. |

## Passos (`passos[]`)

Executados em ordem, na mesma aba (o estado passa de um passo para o outro).

| Campo | Uso |
|---|---|
| `id` | Nome do arquivo: `01-menu-leads` → `img/01-menu-leads.png`. Use prefixo numérico. |
| `ir` | Caminho a abrir antes das ações, ex. `/crm/leads` (ver `docs/MAPA_DE_ROTAS.md`). Espera a rede e o splash `#vp-boot` sumirem. |
| `acoes` | Lista executada em ordem; cada item usa UMA chave: `clicar`, `preencher` + `valor`, `selecionar` + `valor`, `passarMouse`, `tecla` (ex. `"Escape"`), `rolarAte`, `esperar` (seletor visível), `esperarMs`. |
| `esperar` | Seletor que precisa estar visível antes do print. |
| `pausaMs` | Pausa final antes do print (padrão 400). |
| `destacar` | Lista `{ alvo, numero?, texto?, posicao? }`. `alvo` = seletor Playwright. `numero` = selo numerado (automático 1, 2, 3… quando há 2+). `texto` = balão preto. `posicao` = `abaixo`/`acima`/`esquerda`/`direita` (automático se omitido). |
| `focar` | `true` (padrão com 1 destaque) escurece o resto da tela. `false` desliga. |
| `recortar` | `"destaque"` = zoom em volta dos destaques (`margem` padrão 140, `larguraMin` 760, `alturaMin` 420). Seletor CSS (ex. `".modal"`) = recorta o elemento (`margem` padrão 24); balões ficam dentro dele. |
| `paginaInteira` | `true` = print da página inteira com rolagem. |
| `manterFoco` | `true` mantém o cursor no último campo (padrão: tira o foco para não aparecer o anel amarelo). |
| `titulo` | Título do passo na página (imperativo). |
| `texto` | Corpo do passo. Mini-Markdown: `**negrito**`, `` `código` ``, `[[Botão]]` (etiqueta de UI), `[link](url)`, listas `- `/`1. `, linha em branco = parágrafo. |
| `dica` / `atencao` | Caixas amarela (dica) e laranja (atenção). |
| `legenda` / `alt` | Legenda sob o print / texto alternativo. |
| `capa` | `true` = este print vira a miniatura na Central de Ajuda (padrão: 2º passo). |
| `oculto` | `true` = passo só de preparação: executa e captura, mas não aparece na página. |

## Dicas de seletor

- Prefira texto visível e `placeholder` copiados do `.jsx`: `button:has-text('Criar Lead')`, `input[placeholder^='Nome do síndico']`.
- Menu lateral: `.sidebar .nav-item:has(.nav-item__label:text-is("Leads"))`.
- Modal aberto: `.modal` (título em `.modal__title`). Cabeçalho da página: `.page-head`, ações em `.page-head__r`.
- Abas na URL: navegue direto, ex. `/logistica/pcp/fila` (abas listadas no mapa de rotas).
- Se o seletor bate em vários elementos, o script usa o primeiro; refine com `:near()`, `:right-of()` ou um contêiner (`.modal button:has-text('Salvar')`).
