# 03 · PLAN — como a solução será construída (26/10/2026)

## Princípio
Mudança **aditiva**: nada do que já funciona (Corrimão/Corte/Separação/Expedição/NF) é redefinido. O que é novo mora em **uma tabela nova + 2 funções novas** e em botões novos nas telas.

## Banco (migration `20261026100000_separacao_destinos.sql`)
**Tabela `separacao_destinos`** (histórico, só insere; nasce **fechada**: RLS ligada, sem acesso direto para `anon`/`authenticated`):
`id`, `codigo_pedido bigint`, `codigo text`, `destino text check in ('quadro','expedicao')`, `ordem_id uuid null` (OP de Corte que originou o envio), `por`, `em`.
Índice único `(codigo_pedido, codigo, destino, coalesce(ordem_id, nil))` → **impede enviar o mesmo item ao mesmo destino duas vezes**.

> Desvio consciente do que foi dito antes ("coluna nas pendências"): a tabela própria é mais segura porque (a) a pendência é encerrada quando o item "chega", (b) OPs de Corte antigas do PCP não têm pendência, (c) mantém histórico. O objetivo confirmado ("saber onde o item está") é o mesmo.

**Função `separacao_enviar_destino(p_codigo_pedido, p_codigo, p_destino, p_ordem_id default null)`** (`security definer`, só `authenticated`):
1. Exige sessão ativa e a alçada **`separacao.enviar_fabricacao`** (a mesma dos botões Corrimão/Corte).
2. Confere que o pedido existe e que o item faz parte dele.
3. **Origem Separação** (`p_ordem_id` nulo): exige a pendência "Na operação" aberta. **Origem Corte** (`p_ordem_id` informado): exige OP de Corte **concluída** do mesmo pedido/item.
4. `expedicao`: só grava o destino ("pronto para expedir"). **Não toca em `pcp_expedicoes`.**
5. `quadro`: se o código é um quadro (`pcp_quadro_variante`) e a origem é a Separação, cria os pedidos de quadro em `quadros_comando` (1 por unidade, mesmo formato do PCP, **mesma chave `origem_omie` → sem duplicar com o botão do PCP**). Se **não** é quadro (ex.: cabo de manobra), **só grava o destino**.
6. Duplicata → erro mostrando quando e quem enviou.

**Função `separacao_destinos_listar(p_codigo_pedido default null)`** (leitura, `authenticated`): devolve os envios gravados + as OPs de Corrimão/Corte do pedido (`frente`, `status`, `numero`) para a tela montar "onde está".

## Front
- `fabricacao-oficina-calc.js`: função pura `localizacaoDoItem(codigo, dados)` → texto/estado ("Em Corte 1/2 concluídas", "No Quadro", "Na Expedição"). **Com testes** em `fabricacao-oficina-calc.test.js`.
- `fabricacao-oficina-store.js`: `enviarDestino(...)` e `listarDestinos(...)`.
- `separacao.jsx`: item "Na operação" com a alçada mostra **4 botões** (Quadro de Comando, Corrimão, Corte, Expedição) e a linha **"Onde está"**.
- `fabricacao-oficina.jsx` (Corte): OP concluída mostra **Enviar para Expedição** e **Enviar para Quadro de Comando**, e o destino já enviado. A lista passa a manter visíveis as OPs de Corte concluídas **que ainda não foram encaminhadas** (hoje elas sumiriam ao concluir).
- `expedicao.jsx`: no detalhe do pedido, itens marcados **"Pronto p/ expedir"**; na lista, selo com a contagem.
- `index.html`: subir o `?v=` de todo arquivo editado (`check-cache-bust`).

## Permissões
Sem alçada nova: `separacao.enviar_fabricacao` vale para os 4 botões da Separação e os 2 do Corte.

## Validação
Testes unitários do helper; migration testada em transação desfeita (envio, duplicata, sem alçada, OP não concluída); `npm test`, `check-cache-bust`, sintaxe Babel. Clique real fica para uma sessão logada (o login local não tem as alçadas).

## Publicação
Migration só com o **"Confirmo"** do Gelson depois de ele ver o SQL exato. Nada é commitado/enviado sem pedido.
