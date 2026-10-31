# Formulário de Escada/Esteira Rolante — URL por tipo de equipamento + planilha técnica (29/10/2026)

Spec original recebida do usuário (`formularioEscadas.md` + um ciclo 01-06 SPECIFY→IMPLEMENT já rascunhado por ele). Este arquivo registra a versão final, já ajustada à arquitetura real do Formulário de Elevador (`src/formulario-elevador.jsx`), que já existe e atende elevador+escada+esteira numa única tela "camaleão" (ver comentário de 15/08 no topo do arquivo).

## Specify

1. Escolher "Tipo de equipamento" (Elevador/Escada Rolante/Esteira Rolante) no 1º card de um formulário muda a URL do navegador para `/comercial/formulario-elevador`, `/comercial/formulario-escada` ou `/comercial/formulario-esteira`, respectivamente. Acesso direto/F5 em qualquer uma das 3 URLs reabre a mesma tela, com o tipo certo pré-selecionado quando é um formulário novo.
2. Os 17 parâmetros da planilha técnica de Escaladores e Esteiras (`formularioEscadas.md`) viram campos de seleção fechada (eram texto livre), com a regra de inclinação/apoio intermediário acima de 6.000 mm de desnível.

## Clarify (decisões tomadas para resolver ambiguidade do pedido original)

- **A tela não tem "um tipo de equipamento" — tem N equipamentos, cada um com o seu tipo** (o próprio comentário de 15/08 documenta isso: "cotação pode ter elevador + escada + esteira juntos"). O pedido original ("ao selecionar Tipo de equipamento, a URL muda") só faz sentido pensando no caso comum (1 equipamento por formulário). Decisão: a URL reflete o tipo do **1º card** (`unidades[0]`) — é o card que domina a imensa maioria dos formulários reais. Trocar o tipo de um 2º/3º card não disputa a URL a cada clique.
- **Formulário sem id (novo)**: abrir via `/comercial/formulario-escada` ou `/comercial/formulario-esteira` já cria o 1º card com aquele tipo (e os defaults da planilha — ver abaixo). `/comercial/formulario-elevador` continua igual a hoje.
- **Formulário com id (edição)**: carrega os dados reais, sem redirecionar por conta do "tipoPadrao" da URL de entrada — e, uma vez carregado, a URL é *replace*ada para bater com o tipo do 1º card de verdade (nunca cria uma entrada nova no Voltar/Avançar do navegador).
- **Canal público** (`formulario-cliente.html`, sem `window.VpRouter`): nenhuma mudança — o efeito de sincronização de URL é um no-op lá (guard `!window.VpRouter`).
- **Chaves da planilha técnica**: `proposta-heranca.js` (`montarBlocoEscadaEsteira`) já lê um conjunto de chaves do `especificacoes` (jsonb) do Formulário pra preencher a Proposta — `uso_previsto`, `desnivel_elevacao` (escada) / `desnivel_vertical` (esteira), `largura_degrau` (escada) / `largura_palete` (esteira), `tensao_alimentacao_equip`, `velocidade_nominal`, `inclinacao`, `disposicao_espaco` (ver `proposta-heranca-escada.test.js`). Decisão: **manter exatamente esses nomes de chave**, só trocando o controle de texto livre pra `<select>` com opções fechadas — não há migration (é tudo jsonb) e a herança pra Proposta continua funcionando sem mudança nenhuma no `proposta-heranca.js`.
- **"Aplicação/Uso" (item 001 da planilha)** já existia como `uso_previsto` (texto livre, "Público (alto tráfego)/privado..."), que já era a fonte do campo `carac` (Comercial/Alto Tráfego) herdado pela Proposta. Decisão: promover esse MESMO campo pra `<select>` fechado (`Comercial`/`Alto Tráfego`), valendo para escada **e** esteira igualmente (a planilha original trata os dois tipos com a mesma tabela única, sem diferenciar a regra de Aplicação/Uso por tipo de equipamento).
- **Velocidade** (item 007) passa a ser um `<select>` cujas opções dependem da Aplicação/Uso escolhida (Comercial → só 0,50 m/s; Alto Tráfego → 0,65 ou 0,75 m/s) — vale igual pra escada e esteira.
- **Inclinação** (item 008): escada vira `<select>` 30°/35°, com aviso (não bloqueio) quando o Desnível Vertical > 6.000 mm e 35° está selecionado, recomendando 30° — decisão de usar aviso em vez de travar a opção, seguindo o padrão já consolidado no restante do Formulário ("avisos, não bloqueios", ver `issue #383`). Esteira é fixa em 12°, só leitura (a planilha não oferece opção pra esteira).
- **Itens novos, sem equivalente anterior no Formulário** (Apoio Intermediário, Iluminação de Balaustrada, Iluminação de Rodapé, Vão Livre entre Apoios, Revestimento Externo/Cladding + Material do Revestimento): chaves novas em `especificacoes` (`apoio_intermediario`, `iluminacao_balaustrada`, `iluminacao_rodape`, `vao_entre_apoios_mm`, `revestimento_externo`, `material_revestimento`) — não consumidas por `proposta-heranca.js`, então são aditivas e não quebram nada.
- **Campos pré-existentes que ficaram DUPLICADOS pela nova lista** (Dados Gerais, Dados Geométricos, Especificações Técnicas, Condições Ambientais, Dados Elétricos das seções livres de texto já existentes) — removidos dessas seções (sem perder dado: a planilha nova usa as MESMAS chaves, só move o controle pro bloco "Parâmetros da Cotação (planilha técnica)", que aparece primeiro). As seções livres continuam existindo com tudo o que NÃO está na tabela de 17 itens (Acabamentos inteiro, Comunicação, Sistema de Segurança, etc.) — nada removido sem equivalente novo.
- **Sem migration**: `especificacoes` já é uma coluna jsonb existente em `formularios_elevador_unidades` (usada há meses por escada/esteira) — só mudam os nomes/valores que o React grava ali dentro.

## Plan

1. `router.js`: `KNOWN_ROUTES` ganha `formulario-escada`/`formulario-esteira`.
2. `shell.jsx`: `BREADCRUMB_MAP`, `HELP_TOPICS` e `TUTORIAIS` ganham entradas para as 2 rotas novas (mesmo módulo "Comercial", mesmo tutorial do Formulário — a tela é a mesma).
3. `app.jsx`: `ROUTE_TITLE`, `SYNC_PASSTHROUGH_ROUTES` e o `switch` de `renderPage` ganham as 2 rotas novas, renderizando `<FormularioElevadorPage tipoPadrao="escada"|"esteira"/>`.
4. `formulario-elevador.jsx`:
   - `feNovaUnidade(identificador, tipoEquipamento)` — 2º argumento novo, com defaults da planilha pra escada/esteira (material do degrau "Inox Preto", apoio intermediário/iluminações "Sem", esteira nasce com inclinação "12°").
   - `FormularioElevadorForm` ganha a prop `tipoPadrao` (só usada quando `!formularioId`, isto é, formulário novo) e um efeito que mantém a URL em sincronia com o tipo do 1º card (`window.VpRouter.navigate(rota, id, null, {replace:true})`).
   - `FormularioElevadorPage` repassa `tipoPadrao`.
   - Novo componente `FEParametrosPlanilha` com os 17 campos da planilha (selects fechados), renderizado no topo de `FEEspecificacoesGenericas`.
   - Seções livres de Dados Gerais/Geométricos/Especificações Técnicas/Condições Ambientais/Dados Elétricos perdem os campos promovidos (sem duplicar).
5. `docs/MAPA_DE_ROTAS.md` regenerado (`node scripts/gerar-mapa-rotas.js`).
6. `?v=` bumpado em `index.html` (router.js, shell.jsx, app.jsx, formulario-elevador.jsx) e `formulario-cliente.html` (formulario-elevador.jsx).

## Analyze (riscos conferidos antes de implementar)

- **Zero mudança nos campos/validação do Elevador** — `tipo_equipamento === 'elevador'` continua pelo caminho de sempre (colunas reais, obrigatoriedade `FE_UNID_OBRIG`/`feFaltandoUnidade`), intocado.
- **RFQ/e-mail ao fornecedor, Precificação e áreas blindadas de e-mail** (`send-email`/`read-inbox`) não foram tocados — só a camada de captura de dados (especificacoes) e a URL mudam.
- **Herança pra Proposta conferida linha a linha** contra `proposta-heranca.js`/`proposta-heranca-escada.test.js` antes de decidir quais chaves manter — ver seção Clarify. Suíte completa (852/852) roda limpa depois da mudança.
- **Multi-equipamento (camaleão)**: a URL só depende do 1º card, documentado explicitamente no código — comportamento esperado, não um bug, se um formulário com elevador+escada mostrar a URL do elevador mesmo depois de adicionar uma escada como 2º card.

## Implement — o que foi feito

Ver commit/PR desta entrega e a seção correspondente em `CLAUDE.md` ("Formulário de Escada/Esteira Rolante — URL por tipo + planilha técnica", 29/10/2026).

**Não testado com clique real no navegador nesta sessão** (sandbox sem Playwright configurado) — validado por: `npm test` (852/852, incluindo os 3 testes novos de `formulario-elevador-escada-calc.test.js`), transform via `@babel/standalone` nos 3 arquivos `.jsx` editados, `node scripts/check-cache-bust.js origin/main` e `node scripts/gerar-mapa-rotas.js` (0 inconsistências).
