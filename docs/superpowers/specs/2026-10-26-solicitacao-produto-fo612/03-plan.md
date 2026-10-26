# 03 — Plan

1. **Banco** (aditivo): `solicitacoes_produto.tipo_cadastro` (`pecas`|`insumo`) e `dados_cadastro` jsonb — migration `20261026110000`.
2. **Store** (`solicitacoes-produto-store.js` v10): listas do FO-612 (unidades, famílias de peças/insumo, estoque mínimo…), `criar()` grava `tipo_cadastro` e `dados_cadastro` (descarta vazios, campos só-peças no insumo, WhatsApp sem a caixa de cliente marcada).
3. **Tela** (`solicitacoes-produto.jsx` v14): `NovaView` com tipo de cadastro, seções, 3 fotos (guardadas em `anexos` com `slot`), WhatsApp do cliente; `DetalheView` mostra os campos novos; "Link do produto" → "Site de referência".
4. **Copiloto:** linha `rota:solicitacoes-produto` em `vp_copiloto_docs` (migration `20261026120000`, só dado) + espelho em `ROUTE_DOCS` do `index.ts` do repo (fallback; **sem redeploy**).
